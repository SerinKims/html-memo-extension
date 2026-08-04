import { browser } from 'wxt/browser';

import { getAnnotationSettings, getPageAnnotations } from './message-service';
import { CONTENT_MESSAGE_TYPES, isMessageResponse, type OverlayState } from '../types/messages';

export interface ActivePageSummary {
  tabId: number;
  title: string;
  url: string;
  annotationCount: number;
}

async function getActiveTab(): Promise<{ id: number; title: string; url: string }> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined || tab.url === undefined) {
    throw new Error('현재 페이지 정보를 확인할 수 없습니다.');
  }
  return { id: tab.id, title: tab.title?.trim() || '제목 없는 페이지', url: tab.url };
}

export async function loadActivePageSummary(): Promise<ActivePageSummary> {
  const tab = await getActiveTab();
  const annotations = await getPageAnnotations(tab.url);
  return { tabId: tab.id, title: tab.title, url: tab.url, annotationCount: annotations.length };
}

export async function openMemoPanelInActiveTab(): Promise<OverlayState> {
  const tab = await getActiveTab();
  const response: unknown = await browser.tabs.sendMessage(tab.id, {
    type: CONTENT_MESSAGE_TYPES.openMemoPanel,
  });
  if (!isMessageResponse<OverlayState>(response) || !response.ok) {
    throw new Error(
      isMessageResponse<OverlayState>(response) && !response.ok
        ? response.error.message
        : '메모 패널을 열지 못했습니다. 먼저 메모 모드를 시작해 주세요.',
    );
  }
  return response.data;
}

function safeFilePart(value: string): string {
  return (
    value
      .replace(/[<>:"/\\|?*]/g, '-')
      .split('')
      .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'web-memo'
  );
}

export async function downloadCurrentPageJsonBackup(): Promise<void> {
  const tab = await getActiveTab();
  const [annotations, settings] = await Promise.all([
    getPageAnnotations(tab.url),
    getAnnotationSettings(),
  ]);
  const backup = {
    format: 'html-memo-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    page: { title: tab.title, url: tab.url },
    annotations,
    settings,
  };
  const blobUrl = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' }),
  );
  try {
    const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    await browser.downloads.download({
      url: blobUrl,
      filename: `${safeFilePart(tab.title)}_${date}_memo-backup.json`,
      saveAs: true,
    });
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1_000);
  }
}
