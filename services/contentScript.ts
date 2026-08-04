import { browser } from 'wxt/browser';

const CONTENT_SCRIPT_PATH = '/content-scripts/content.js';

export async function loadContentScriptForActiveTab(): Promise<void> {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });

  if (activeTab?.id === undefined) {
    throw new Error('현재 페이지를 찾을 수 없습니다. 일반 웹페이지를 연 뒤 다시 시도해 주세요.');
  }

  await browser.scripting.executeScript({
    target: { tabId: activeTab.id },
    files: [CONTENT_SCRIPT_PATH],
  });
}
