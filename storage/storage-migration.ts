import type { Annotation } from '../types/annotation';
import type { StorageLoadResult, StoredDataV1 } from '../types/storage';
import {
  CURRENT_SCHEMA_VERSION,
  createEmptyStoredData,
  sanitizeAnnotations,
  sanitizeSettings,
} from './storage-schema';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function migrateLegacyAnnotation(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const migrated: Record<string, unknown> = {
    ...value,
    pageKey: value.pageKey ?? value.pageId,
    content: value.content ?? value.body,
    author: value.author ?? '',
    color: value.color ?? 'yellow',
    originalUrl: value.originalUrl ?? value.url,
  };

  if (value.type === 'point' && migrated.position === undefined && isRecord(value.anchor)) {
    migrated.position = {
      xRatio: value.anchor.ratioX,
      yRatio: value.anchor.ratioY,
    };
  }

  if (value.type === 'area' && migrated.position === undefined && isRecord(value.anchor)) {
    const rect = isRecord(value.anchor.rect) ? value.anchor.rect : value.anchor;
    migrated.position = {
      xRatio: rect.ratioX,
      yRatio: rect.ratioY,
      widthRatio: rect.ratioWidth,
      heightRatio: rect.ratioHeight,
    };
  }

  if (value.type === 'text' && isRecord(value.anchor)) {
    migrated.anchor = {
      exactText: value.anchor.exactText ?? value.anchor.selectedText,
      prefixText: value.anchor.prefixText ?? '',
      suffixText: value.anchor.suffixText ?? '',
      ...(typeof value.anchor.cssSelector === 'string'
        ? { cssSelector: value.anchor.cssSelector }
        : typeof value.anchor.selector === 'string'
          ? { cssSelector: value.anchor.selector }
          : {}),
      ...(typeof value.anchor.startOffset === 'number'
        ? { startOffset: value.anchor.startOffset }
        : isRecord(value.anchor.rangeHint) && typeof value.anchor.rangeHint.startOffset === 'number'
          ? { startOffset: value.anchor.rangeHint.startOffset }
          : {}),
      ...(typeof value.anchor.endOffset === 'number'
        ? { endOffset: value.anchor.endOffset }
        : isRecord(value.anchor.rangeHint) && typeof value.anchor.rangeHint.endOffset === 'number'
          ? { endOffset: value.anchor.rangeHint.endOffset }
          : {}),
    };
  }

  return migrated;
}

function buildData(
  annotations: Annotation[],
  settings: StoredDataV1['settings'],
  updatedAt: string,
): StoredDataV1 {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    annotations,
    settings,
    updatedAt,
  };
}

export function migrateStorageData(raw: unknown, now: string): StorageLoadResult {
  if (!isRecord(raw)) {
    return {
      data: createEmptyStoredData(now),
      recovery: {
        migrated: raw !== undefined,
        discardedAnnotationCount: raw === undefined ? 0 : 1,
      },
    };
  }

  if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new RangeError('이 데이터는 더 최신 버전에서 만들어져 현재 버전으로 열 수 없습니다.');
  }

  const isCurrentVersion = raw.schemaVersion === CURRENT_SCHEMA_VERSION;
  const sourceAnnotations = isCurrentVersion
    ? raw.annotations
    : Array.isArray(raw.annotations)
      ? raw.annotations.map(migrateLegacyAnnotation)
      : Array.isArray(raw.notes)
        ? raw.notes.map(migrateLegacyAnnotation)
        : raw.annotations;
  const { annotations, discardedCount } = sanitizeAnnotations(sourceAnnotations);
  const updatedAt =
    typeof raw.updatedAt === 'string' && Number.isFinite(Date.parse(raw.updatedAt))
      ? raw.updatedAt
      : now;

  return {
    data: buildData(annotations, sanitizeSettings(raw.settings), updatedAt),
    recovery: {
      migrated: !isCurrentVersion || discardedCount > 0,
      discardedAnnotationCount: discardedCount,
    },
  };
}
