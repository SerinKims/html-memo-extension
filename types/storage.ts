import type { Annotation, AnnotationColor } from './annotation';

export const STORAGE_QUOTA_BYTES = 10_485_760;

export type StorageUsageLevel = 'normal' | 'warning' | 'cleanupRecommended' | 'critical';

export interface StorageUsage {
  measuredAt: string;
  bytesInUse: number;
  quotaBytes: number;
  ratio: number;
  level: StorageUsageLevel;
}

export interface StorageSettings {
  defaultAuthor: string;
  defaultColor: AnnotationColor;
  htmlFilenamePattern: string;
  includeResolvedInExport: boolean;
  showPinNumbers: boolean;
}

export interface StoredDataV1 {
  schemaVersion: 1;
  annotations: Annotation[];
  settings: StorageSettings;
  updatedAt: string;
}

export type StorageErrorCode =
  'invalid_input' | 'not_found' | 'quota_exceeded' | 'unsupported_schema' | 'storage_unavailable';

export interface StorageError {
  code: StorageErrorCode;
  message: string;
  cause?: unknown;
}

export type RepositoryResult<T> = { ok: true; data: T } | { ok: false; error: StorageError };

export interface StorageRecovery {
  migrated: boolean;
  discardedAnnotationCount: number;
}

export interface StorageLoadResult {
  data: StoredDataV1;
  recovery: StorageRecovery;
}
