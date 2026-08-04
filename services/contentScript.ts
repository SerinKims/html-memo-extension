import { browser } from 'wxt/browser';

import { EXPORT_MARKER_NAME } from '../types/export';
import { activateMemoModeInTab } from './message-service';

const CONTENT_SCRIPT_PATH = '/content-scripts/content.js';

export class FileAccessRequiredError extends Error {
  public constructor() {
    super(
      '로컬 HTML에 메모하려면 Chrome 확장 프로그램 관리 화면에서 “파일 URL에 대한 액세스 허용”을 켜 주세요.',
    );
    this.name = 'FileAccessRequiredError';
  }
}

export interface MemoModeActivationResult {
  mode: 'overlay' | 'review-file';
}

interface PagePreflightResult {
  contentType: string;
  isExportedReview: boolean;
}

export async function openExtensionDetailsPage(): Promise<void> {
  await browser.tabs.create({ url: `chrome://extensions/?id=${browser.runtime.id}` });
}

export async function loadContentScriptForActiveTab(): Promise<MemoModeActivationResult> {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });

  if (activeTab?.id === undefined || activeTab.url === undefined) {
    throw new Error('현재 페이지를 찾을 수 없습니다. 일반 웹페이지를 연 뒤 다시 시도해 주세요.');
  }

  if (activeTab.url.startsWith('file:')) {
    const isAllowed = await browser.extension.isAllowedFileSchemeAccess();
    if (!isAllowed) {
      throw new FileAccessRequiredError();
    }
  }

  const [preflight] = await browser.scripting.executeScript({
    target: { tabId: activeTab.id },
    func: (markerName): PagePreflightResult => ({
      contentType: document.contentType,
      isExportedReview:
        document.querySelector(`meta[name="${markerName}"]`)?.getAttribute('content') === '2',
    }),
    args: [EXPORT_MARKER_NAME],
  });
  const page = preflight?.result;
  if (page === undefined || page.contentType !== 'text/html') {
    throw new Error('HTML 문서에서만 메모 모드를 시작할 수 있습니다.');
  }
  if (page.isExportedReview) {
    return { mode: 'review-file' };
  }

  await browser.scripting.executeScript({
    target: { tabId: activeTab.id },
    files: [CONTENT_SCRIPT_PATH],
  });

  await activateMemoModeInTab(activeTab.id);
  return { mode: 'overlay' };
}
