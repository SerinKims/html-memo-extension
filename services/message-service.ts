import { browser } from 'wxt/browser';

import {
  BACKGROUND_MESSAGE_TYPES,
  CONTENT_MESSAGE_TYPES,
  isMessageResponse,
  type MessageResponse,
  type OverlayState,
} from '../types/messages';
import type {
  Annotation,
  AnnotationChanges,
  AreaAnnotation,
  CreateAnnotationInput,
  PointAnnotation,
  PointPosition,
  TextAnnotation,
} from '../types/annotation';
import type { StorageSettings } from '../types/storage';

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

export function getPageAnnotations(url: string): Promise<Annotation[]> {
  const response = browser.runtime.sendMessage({
    type: BACKGROUND_MESSAGE_TYPES.getPageAnnotations,
    payload: { url },
  });
  return unwrapResponse<Annotation[]>(response, '현재 페이지의 메모를 불러오지 못했습니다.');
}

export function getPagePointAnnotations(url: string): Promise<PointAnnotation[]> {
  const response = browser.runtime.sendMessage({
    type: BACKGROUND_MESSAGE_TYPES.getPagePointAnnotations,
    payload: { url },
  });
  return unwrapResponse<PointAnnotation[]>(
    response,
    '현재 페이지의 위치 메모를 불러오지 못했습니다.',
  );
}

export function getPageTextAnnotations(url: string): Promise<TextAnnotation[]> {
  const response = browser.runtime.sendMessage({
    type: BACKGROUND_MESSAGE_TYPES.getPageTextAnnotations,
    payload: { url },
  });
  return unwrapResponse<TextAnnotation[]>(
    response,
    '현재 페이지의 텍스트 메모를 불러오지 못했습니다.',
  );
}

export function getPageAreaAnnotations(url: string): Promise<AreaAnnotation[]> {
  const response = browser.runtime.sendMessage({
    type: BACKGROUND_MESSAGE_TYPES.getPageAreaAnnotations,
    payload: { url },
  });
  return unwrapResponse<AreaAnnotation[]>(
    response,
    '현재 페이지의 영역 메모를 불러오지 못했습니다.',
  );
}

export function createAnnotation(input: CreateAnnotationInput): Promise<Annotation> {
  const response = browser.runtime.sendMessage({
    type: BACKGROUND_MESSAGE_TYPES.createAnnotation,
    payload: input,
  });
  return unwrapResponse<Annotation>(response, '메모를 저장하지 못했습니다.');
}

export function updateAnnotation(id: string, changes: AnnotationChanges): Promise<Annotation> {
  const response = browser.runtime.sendMessage({
    type: BACKGROUND_MESSAGE_TYPES.updateAnnotation,
    payload: { id, changes },
  });
  return unwrapResponse<Annotation>(response, '메모를 수정하지 못했습니다.');
}

export function movePointAnnotation(id: string, position: PointPosition): Promise<PointAnnotation> {
  const response = browser.runtime.sendMessage({
    type: BACKGROUND_MESSAGE_TYPES.movePointAnnotation,
    payload: { id, position },
  });
  return unwrapResponse<PointAnnotation>(response, '메모 위치를 저장하지 못했습니다.');
}

export function deleteAnnotation(id: string): Promise<boolean> {
  const response = browser.runtime.sendMessage({
    type: BACKGROUND_MESSAGE_TYPES.deleteAnnotation,
    payload: { id },
  });
  return unwrapResponse<boolean>(response, '메모를 삭제하지 못했습니다.');
}

export function getAnnotationSettings(): Promise<StorageSettings> {
  const response = browser.runtime.sendMessage({ type: BACKGROUND_MESSAGE_TYPES.getSettings });
  return unwrapResponse<StorageSettings>(response, '메모 설정을 불러오지 못했습니다.');
}

export function updateAnnotationSettings(
  changes: Partial<StorageSettings>,
): Promise<StorageSettings> {
  const response = browser.runtime.sendMessage({
    type: BACKGROUND_MESSAGE_TYPES.updateSettings,
    payload: changes,
  });
  return unwrapResponse<StorageSettings>(response, '메모 설정을 저장하지 못했습니다.');
}
