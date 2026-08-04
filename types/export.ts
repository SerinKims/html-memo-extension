import type {
  AnnotationColor,
  AnnotationStatus,
  AreaPosition,
  PointPosition,
  TextAnchor,
} from './annotation';

export const EXPORT_SCHEMA_VERSION = 2 as const;
export const EXPORT_MARKER_NAME = 'html-memo-export';
export const EXPORT_DATA_ELEMENT_ID = 'review-data';

export type ExportSource =
  | { kind: 'web'; displayName: string; url: string }
  | { kind: 'local-file'; displayName: string; fileName: string };

interface ExportNoteBase {
  id: string;
  content: string;
  author: string;
  color: AnnotationColor;
  status: AnnotationStatus;
  origin: 'capture' | 'review';
  createdAt: string;
  updatedAt: string;
}

export interface ExportPointNote extends ExportNoteBase {
  type: 'point';
  position: PointPosition;
}

export interface ExportAreaNote extends ExportNoteBase {
  type: 'area';
  position: AreaPosition;
}

export interface ExportTextNote extends ExportNoteBase {
  type: 'text';
  anchor: TextAnchor;
}

export interface ExportCommentNote extends ExportNoteBase {
  type: 'comment';
}

export type ExportNote = ExportPointNote | ExportAreaNote | ExportTextNote | ExportCommentNote;

export interface ExportDocumentV2 {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  documentId: string;
  revision: number;
  exportedAt: string;
  generator: {
    name: 'web-memo-html-extension';
    version: string;
  };
  source: ExportSource;
  page: {
    title: string;
    capturedAt: string;
    documentWidth: number;
    documentHeight: number;
  };
  screenshot: {
    mimeType: 'image/png' | 'image/jpeg';
    dataUrl: string;
    width: number;
    height: number;
  };
  notes: ExportNote[];
  redaction: {
    applied: boolean;
    removedFields: string[];
    maskedPatterns: string[];
    userConfirmed: boolean;
  };
}
