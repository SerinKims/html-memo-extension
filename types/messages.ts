export const CONTENT_MESSAGE_TYPES = {
  activateMemoMode: 'content/activate-memo-mode',
  deactivateMemoMode: 'content/deactivate-memo-mode',
  getOverlayState: 'content/get-overlay-state',
} as const;

export const BACKGROUND_MESSAGE_TYPES = {
  getPageAnnotationCount: 'background/get-page-annotation-count',
} as const;

export type OverlayTool = 'point' | 'text' | 'area';

export interface OverlayState {
  isActive: boolean;
  selectedTool: OverlayTool | null;
  annotationCount: number | null;
  url: string;
}

export interface ActivateMemoModeMessage {
  type: typeof CONTENT_MESSAGE_TYPES.activateMemoMode;
}

export interface DeactivateMemoModeMessage {
  type: typeof CONTENT_MESSAGE_TYPES.deactivateMemoMode;
}

export interface GetOverlayStateMessage {
  type: typeof CONTENT_MESSAGE_TYPES.getOverlayState;
}

export interface GetPageAnnotationCountMessage {
  type: typeof BACKGROUND_MESSAGE_TYPES.getPageAnnotationCount;
  payload: {
    url: string;
  };
}

export type ContentMessage =
  ActivateMemoModeMessage | DeactivateMemoModeMessage | GetOverlayStateMessage;

export type BackgroundMessage = GetPageAnnotationCountMessage;
export type ExtensionMessage = ContentMessage | BackgroundMessage;

export interface MessageSuccess<T> {
  ok: true;
  data: T;
}

export interface MessageFailure {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type MessageResponse<T> = MessageSuccess<T> | MessageFailure;

export function messageSuccess<T>(data: T): MessageSuccess<T> {
  return { ok: true, data };
}

export function messageFailure(code: string, message: string): MessageFailure {
  return { ok: false, error: { code, message } };
}

export function isContentMessage(value: unknown): value is ContentMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }

  const type = value.type;
  return Object.values(CONTENT_MESSAGE_TYPES).some((candidate) => candidate === type);
}

export function isGetPageAnnotationCountMessage(
  value: unknown,
): value is GetPageAnnotationCountMessage {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('type' in value) ||
    value.type !== BACKGROUND_MESSAGE_TYPES.getPageAnnotationCount ||
    !('payload' in value) ||
    typeof value.payload !== 'object' ||
    value.payload === null ||
    !('url' in value.payload)
  ) {
    return false;
  }

  return typeof value.payload.url === 'string';
}

export function isMessageResponse<T>(value: unknown): value is MessageResponse<T> {
  if (typeof value !== 'object' || value === null || !('ok' in value)) {
    return false;
  }

  if (value.ok === true) {
    return 'data' in value;
  }

  return (
    value.ok === false &&
    'error' in value &&
    typeof value.error === 'object' &&
    value.error !== null &&
    'message' in value.error &&
    typeof value.error.message === 'string'
  );
}
