import { browser } from 'wxt/browser';

import {
  BACKGROUND_MESSAGE_TYPES,
  CONTENT_MESSAGE_TYPES,
  isMessageResponse,
  type MessageResponse,
  type OverlayState,
} from '../types/messages';

export class MessageServiceError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'MessageServiceError';
  }
}

async function unwrapResponse<T>(request: Promise<unknown>, fallbackMessage: string): Promise<T> {
  let response: unknown;

  try {
    response = await request;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new MessageServiceError(`${fallbackMessage} (${detail})`);
  }

  if (!isMessageResponse<T>(response)) {
    throw new MessageServiceError(`${fallbackMessage} (올바르지 않은 응답)`);
  }

  if (!response.ok) {
    throw new MessageServiceError(response.error.message);
  }

  return response.data;
}

export function activateMemoModeInTab(tabId: number): Promise<OverlayState> {
  const response = browser.tabs.sendMessage(tabId, {
    type: CONTENT_MESSAGE_TYPES.activateMemoMode,
  });
  return unwrapResponse<OverlayState>(response, '현재 페이지에서 메모 모드를 시작하지 못했습니다.');
}

export function deactivateMemoModeInTab(tabId: number): Promise<OverlayState> {
  const response = browser.tabs.sendMessage(tabId, {
    type: CONTENT_MESSAGE_TYPES.deactivateMemoMode,
  });
  return unwrapResponse<OverlayState>(response, '현재 페이지의 메모 모드를 종료하지 못했습니다.');
}

export function getOverlayStateFromTab(tabId: number): Promise<OverlayState> {
  const response = browser.tabs.sendMessage(tabId, {
    type: CONTENT_MESSAGE_TYPES.getOverlayState,
  });
  return unwrapResponse<OverlayState>(
    response,
    '현재 페이지의 메모 모드 상태를 확인하지 못했습니다.',
  );
}

export function getPageAnnotationCount(url: string): Promise<number> {
  const response: Promise<MessageResponse<number>> = browser.runtime.sendMessage({
    type: BACKGROUND_MESSAGE_TYPES.getPageAnnotationCount,
    payload: { url },
  });
  return unwrapResponse<number>(response, '현재 페이지의 메모 수를 불러오지 못했습니다.');
}
