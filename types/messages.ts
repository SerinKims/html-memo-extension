import type {
  Annotation,
  AnnotationChanges,
  AreaAnnotation,
  CreateAnnotationInput,
  PointAnnotation,
  PointPosition,
} from './annotation';
import type { StorageSettings } from './storage';

export const CONTENT_MESSAGE_TYPES = {
  activateMemoMode: 'content/activate-memo-mode',
  deactivateMemoMode: 'content/deactivate-memo-mode',
  getOverlayState: 'content/get-overlay-state',
} as const;

export const BACKGROUND_MESSAGE_TYPES = {
  getPageAnnotationCount: 'background/get-page-annotation-count',
  getPagePointAnnotations: 'background/get-page-point-annotations',
  getPageTextAnnotations: 'background/get-page-text-annotations',
  getPageAreaAnnotations: 'background/get-page-area-annotations',
  createAnnotation: 'background/create-annotation',
  updateAnnotation: 'background/update-annotation',
  movePointAnnotation: 'background/move-point-annotation',
  deleteAnnotation: 'background/delete-annotation',
  getSettings: 'background/get-settings',
  updateSettings: 'background/update-settings',
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

export interface GetPagePointAnnotationsMessage {
  type: typeof BACKGROUND_MESSAGE_TYPES.getPagePointAnnotations;
  payload: { url: string };
}

export interface GetPageTextAnnotationsMessage {
  type: typeof BACKGROUND_MESSAGE_TYPES.getPageTextAnnotations;
  payload: { url: string };
}

export interface GetPageAreaAnnotationsMessage {
  type: typeof BACKGROUND_MESSAGE_TYPES.getPageAreaAnnotations;
  payload: { url: string };
}

export interface CreateAnnotationMessage {
  type: typeof BACKGROUND_MESSAGE_TYPES.createAnnotation;
  payload: CreateAnnotationInput;
}

export interface UpdateAnnotationMessage {
  type: typeof BACKGROUND_MESSAGE_TYPES.updateAnnotation;
  payload: { id: string; changes: AnnotationChanges };
}

export interface MovePointAnnotationMessage {
  type: typeof BACKGROUND_MESSAGE_TYPES.movePointAnnotation;
  payload: { id: string; position: PointPosition };
}

export interface DeleteAnnotationMessage {
  type: typeof BACKGROUND_MESSAGE_TYPES.deleteAnnotation;
  payload: { id: string };
}

export interface GetSettingsMessage {
  type: typeof BACKGROUND_MESSAGE_TYPES.getSettings;
}

export interface UpdateSettingsMessage {
  type: typeof BACKGROUND_MESSAGE_TYPES.updateSettings;
  payload: Partial<StorageSettings>;
}

export type ContentMessage =
  ActivateMemoModeMessage | DeactivateMemoModeMessage | GetOverlayStateMessage;

export type BackgroundMessage =
  | GetPageAnnotationCountMessage
  | GetPagePointAnnotationsMessage
  | GetPageTextAnnotationsMessage
  | GetPageAreaAnnotationsMessage
  | CreateAnnotationMessage
  | UpdateAnnotationMessage
  | MovePointAnnotationMessage
  | DeleteAnnotationMessage
  | GetSettingsMessage
  | UpdateSettingsMessage;
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

export function isBackgroundMessage(value: unknown): value is BackgroundMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }
  return Object.values(BACKGROUND_MESSAGE_TYPES).some((candidate) => candidate === value.type);
}

export interface PointAnnotationGateway {
  getByPage(url: string): Promise<PointAnnotation[]>;
  create(input: CreateAnnotationInput): Promise<Annotation>;
  update(id: string, changes: AnnotationChanges): Promise<Annotation>;
  move(id: string, position: PointPosition): Promise<PointAnnotation>;
  delete(id: string): Promise<boolean>;
  getSettings(): Promise<StorageSettings>;
  updateSettings(changes: Partial<StorageSettings>): Promise<StorageSettings>;
}

export interface TextAnnotationGateway {
  getByPage(url: string): Promise<import('./annotation').TextAnnotation[]>;
  create(input: CreateAnnotationInput): Promise<Annotation>;
  update(id: string, changes: AnnotationChanges): Promise<Annotation>;
  delete(id: string): Promise<boolean>;
}

export interface AreaAnnotationGateway {
  getByPage(url: string): Promise<AreaAnnotation[]>;
  create(input: CreateAnnotationInput): Promise<Annotation>;
  update(id: string, changes: AnnotationChanges): Promise<Annotation>;
  delete(id: string): Promise<boolean>;
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
