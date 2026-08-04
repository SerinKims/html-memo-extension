import {
  ANNOTATION_COLORS,
  ANNOTATION_STATUSES,
  ANNOTATION_TYPES,
  type Annotation,
  type AreaPosition,
  type PointPosition,
  type TextAnchor,
} from '../types/annotation';
import type { StoredDataV1, StorageSettings, StorageUsageLevel } from '../types/storage';

export const STORAGE_KEY = 'memoHtml.storage';
export const CURRENT_SCHEMA_VERSION = 1 as const;

export const DEFAULT_STORAGE_SETTINGS: StorageSettings = {
  defaultAuthor: '',
  defaultColor: 'yellow',
};

export function createEmptyStoredData(now: string): StoredDataV1 {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    annotations: [],
    settings: { ...DEFAULT_STORAGE_SETTINGS },
    updatedAt: now,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteRatio(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isPointPosition(value: unknown): value is PointPosition {
  return isRecord(value) && isFiniteRatio(value.xRatio) && isFiniteRatio(value.yRatio);
}

function isAreaPosition(value: unknown): value is AreaPosition {
  return (
    isRecord(value) &&
    isFiniteRatio(value.xRatio) &&
    isFiniteRatio(value.yRatio) &&
    isFiniteRatio(value.widthRatio) &&
    isFiniteRatio(value.heightRatio) &&
    value.xRatio + value.widthRatio <= 1 &&
    value.yRatio + value.heightRatio <= 1
  );
}

function isAnnotationColor(value: unknown): value is StorageSettings['defaultColor'] {
  return ANNOTATION_COLORS.some((color) => color === value);
}

function isOptionalNonNegativeInteger(value: unknown): boolean {
  return value === undefined || (Number.isInteger(value) && (value as number) >= 0);
}

function isTextAnchor(value: unknown): value is TextAnchor {
  return (
    isRecord(value) &&
    typeof value.exactText === 'string' &&
    typeof value.prefixText === 'string' &&
    typeof value.suffixText === 'string' &&
    (value.cssSelector === undefined || typeof value.cssSelector === 'string') &&
    isOptionalNonNegativeInteger(value.startOffset) &&
    isOptionalNonNegativeInteger(value.endOffset) &&
    !(
      typeof value.startOffset === 'number' &&
      typeof value.endOffset === 'number' &&
      value.startOffset > value.endOffset
    )
  );
}

export function isAnnotation(value: unknown): value is Annotation {
  if (!isRecord(value)) {
    return false;
  }

  const hasValidBase =
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.pageKey === 'string' &&
    value.pageKey.length > 0 &&
    typeof value.originalUrl === 'string' &&
    typeof value.pageTitle === 'string' &&
    typeof value.content === 'string' &&
    typeof value.author === 'string' &&
    ANNOTATION_TYPES.some((type) => type === value.type) &&
    ANNOTATION_COLORS.some((color) => color === value.color) &&
    ANNOTATION_STATUSES.some((status) => status === value.status) &&
    isIsoDate(value.createdAt) &&
    isIsoDate(value.updatedAt);

  if (!hasValidBase) {
    return false;
  }

  switch (value.type) {
    case 'point':
      return isPointPosition(value.position);
    case 'text':
      return isTextAnchor(value.anchor);
    case 'area':
      return isAreaPosition(value.position);
    default:
      return false;
  }
}

export function sanitizeAnnotations(value: unknown): {
  annotations: Annotation[];
  discardedCount: number;
} {
  if (!Array.isArray(value)) {
    return { annotations: [], discardedCount: value === undefined ? 0 : 1 };
  }

  const annotations = value.flatMap((candidate): Annotation[] => {
    if (!isAnnotation(candidate)) {
      return [];
    }

    const base = {
      id: candidate.id,
      pageKey: candidate.pageKey,
      originalUrl: candidate.originalUrl,
      pageTitle: candidate.pageTitle,
      content: candidate.content,
      author: candidate.author,
      color: candidate.color,
      status: candidate.status,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    };

    if (candidate.type === 'text') {
      const anchor: TextAnchor = {
        exactText: candidate.anchor.exactText,
        prefixText: candidate.anchor.prefixText,
        suffixText: candidate.anchor.suffixText,
        ...(candidate.anchor.cssSelector === undefined
          ? {}
          : { cssSelector: candidate.anchor.cssSelector }),
        ...(candidate.anchor.startOffset === undefined
          ? {}
          : { startOffset: candidate.anchor.startOffset }),
        ...(candidate.anchor.endOffset === undefined
          ? {}
          : { endOffset: candidate.anchor.endOffset }),
      };
      return [{ ...base, type: 'text', anchor }];
    }

    if (candidate.type === 'area') {
      return [{ ...base, type: 'area', position: { ...candidate.position } }];
    }

    return [{ ...base, type: 'point', position: { ...candidate.position } }];
  });
  return { annotations, discardedCount: value.length - annotations.length };
}

export function sanitizeSettings(value: unknown): StorageSettings {
  if (!isRecord(value)) {
    return { ...DEFAULT_STORAGE_SETTINGS };
  }

  return {
    defaultAuthor: typeof value.defaultAuthor === 'string' ? value.defaultAuthor : '',
    defaultColor: isAnnotationColor(value.defaultColor) ? value.defaultColor : 'yellow',
  };
}

export function getStorageUsageLevel(ratio: number): StorageUsageLevel {
  if (ratio >= 0.95) {
    return 'critical';
  }
  if (ratio >= 0.8) {
    return 'cleanupRecommended';
  }
  if (ratio >= 0.6) {
    return 'warning';
  }
  return 'normal';
}
