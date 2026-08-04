import type { Annotation, AnnotationColor } from '../types/annotation';
import {
  EXPORT_SCHEMA_VERSION,
  type ExportDocumentV2,
  type ExportNote,
  type ExportSource,
} from '../types/export';
import { normalizeUrl } from '../utils/url-normalizer';

export interface CreateExportDocumentInput {
  sourceUrl: string;
  pageTitle: string;
  capturedAt: string;
  documentWidth: number;
  documentHeight: number;
  screenshot: ExportDocumentV2['screenshot'];
  annotations: readonly Annotation[];
  redaction: ExportDocumentV2['redaction'];
  generatorVersion: string;
  exportedAt?: string;
  documentId?: string;
}

interface MigrationOptions {
  documentId?: string;
  now?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function localFileName(url: URL): string {
  const encodedName = url.pathname.split('/').filter(Boolean).at(-1) ?? 'local-document.html';
  try {
    return decodeURIComponent(encodedName);
  } catch {
    return encodedName;
  }
}

function sanitizeLocalDisplayName(value: string, fileName: string): string {
  const candidate = value.trim();
  if (
    candidate.length === 0 ||
    candidate.includes('/') ||
    candidate.includes('\\') ||
    /^[a-z]:/i.test(candidate) ||
    /^file:/i.test(candidate)
  ) {
    return fileName;
  }
  return candidate;
}

function sanitizeLocalFileName(value: string): string {
  const name = value.split(/[\\/]/).filter(Boolean).at(-1)?.trim();
  return name || 'local-document.html';
}

function assertEmbeddedScreenshot(document: ExportDocumentV2): void {
  if (!/^data:image\/(?:png|jpeg);base64,/i.test(document.screenshot.dataUrl)) {
    throw new TypeError('스크린샷은 Base64 PNG 또는 JPEG 데이터 URL이어야 합니다.');
  }
}

export function createExportSource(sourceUrl: string, pageTitle: string): ExportSource {
  const url = new URL(sourceUrl);
  if (url.protocol === 'file:') {
    const fileName = localFileName(url);
    return {
      kind: 'local-file',
      displayName: sanitizeLocalDisplayName(pageTitle, fileName),
      fileName,
    };
  }

  const normalizedUrl = normalizeUrl(sourceUrl);
  return {
    kind: 'web',
    displayName: pageTitle.trim() || new URL(normalizedUrl).hostname,
    url: normalizedUrl,
  };
}

function toExportNote(annotation: Annotation): ExportNote {
  const base = {
    id: annotation.id,
    content: annotation.content,
    author: annotation.author,
    color: annotation.color,
    status: annotation.status,
    origin: 'capture' as const,
    createdAt: annotation.createdAt,
    updatedAt: annotation.updatedAt,
  };

  if (annotation.type === 'text') {
    return { ...base, type: 'text', anchor: structuredClone(annotation.anchor) };
  }
  if (annotation.type === 'area') {
    return { ...base, type: 'area', position: structuredClone(annotation.position) };
  }
  return { ...base, type: 'point', position: structuredClone(annotation.position) };
}

export function createExportDocument(input: CreateExportDocumentInput): ExportDocumentV2 {
  const source = createExportSource(input.sourceUrl, input.pageTitle);
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    documentId: input.documentId ?? crypto.randomUUID(),
    revision: 1,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    generator: {
      name: 'web-memo-html-extension',
      version: input.generatorVersion,
    },
    source,
    page: {
      title: source.kind === 'local-file' ? source.displayName : input.pageTitle,
      capturedAt: input.capturedAt,
      documentWidth: input.documentWidth,
      documentHeight: input.documentHeight,
    },
    screenshot: structuredClone(input.screenshot),
    notes: input.annotations.map(toExportNote),
    redaction: structuredClone(input.redaction),
  };
}

function migrateLegacyNote(value: unknown, now: string, index: number): ExportNote | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = value.type;
  const content = stringValue(value.content, stringValue(value.body));
  const color: AnnotationColor =
    value.color === 'red' ||
    value.color === 'green' ||
    value.color === 'blue' ||
    value.color === 'purple'
      ? value.color
      : 'yellow';
  const base = {
    id: stringValue(value.id, `legacy-note-${index + 1}`),
    content,
    author: stringValue(value.author),
    color,
    status: value.status === 'resolved' ? ('resolved' as const) : ('open' as const),
    origin: 'capture' as const,
    createdAt: stringValue(value.createdAt, now),
    updatedAt: stringValue(value.updatedAt, now),
  };

  const position = isRecord(value.position) ? value.position : null;
  const anchor = isRecord(value.anchor) ? value.anchor : null;
  if (type === 'point') {
    return {
      ...base,
      type: 'point',
      position: {
        xRatio: numberValue(position?.xRatio, numberValue(anchor?.ratioX)),
        yRatio: numberValue(position?.yRatio, numberValue(anchor?.ratioY)),
      },
    };
  }
  if (type === 'area') {
    const rect = isRecord(anchor?.rect) ? anchor.rect : anchor;
    return {
      ...base,
      type: 'area',
      position: {
        xRatio: numberValue(position?.xRatio, numberValue(rect?.ratioX)),
        yRatio: numberValue(position?.yRatio, numberValue(rect?.ratioY)),
        widthRatio: numberValue(position?.widthRatio, numberValue(rect?.ratioWidth)),
        heightRatio: numberValue(position?.heightRatio, numberValue(rect?.ratioHeight)),
      },
    };
  }
  if (type === 'text') {
    return {
      ...base,
      type: 'text',
      anchor: {
        exactText: stringValue(anchor?.exactText, stringValue(anchor?.selectedText)),
        prefixText: stringValue(anchor?.prefixText),
        suffixText: stringValue(anchor?.suffixText),
        ...(typeof anchor?.cssSelector === 'string'
          ? { cssSelector: anchor.cssSelector }
          : typeof anchor?.selector === 'string'
            ? { cssSelector: anchor.selector }
            : {}),
      },
    };
  }
  return null;
}

function migrateLegacyDocument(
  value: Record<string, unknown>,
  options: MigrationOptions,
): ExportDocumentV2 {
  const now = options.now ?? new Date().toISOString();
  const page = isRecord(value.page) ? value.page : {};
  const screenshot = isRecord(value.screenshot) ? value.screenshot : {};
  const generator = isRecord(value.generator) ? value.generator : {};
  const redaction = isRecord(value.redaction) ? value.redaction : {};
  const pageUrl = stringValue(page.url, 'https://invalid.local/');
  const pageTitle = stringValue(page.title, '검토 문서');
  const notes = Array.isArray(value.notes)
    ? value.notes.flatMap((note, index) => {
        const migrated = migrateLegacyNote(note, now, index);
        return migrated === null ? [] : [migrated];
      })
    : [];
  const source = createExportSource(pageUrl, pageTitle);

  const migrated: ExportDocumentV2 = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    documentId: options.documentId ?? crypto.randomUUID(),
    revision: 1,
    exportedAt: stringValue(value.exportedAt, now),
    generator: {
      name: 'web-memo-html-extension',
      version: stringValue(generator.version, '1'),
    },
    source,
    page: {
      title: source.kind === 'local-file' ? source.displayName : pageTitle,
      capturedAt: stringValue(page.capturedAt, now),
      documentWidth: numberValue(page.documentWidth, numberValue(screenshot.width)),
      documentHeight: numberValue(page.documentHeight, numberValue(screenshot.height)),
    },
    screenshot: {
      mimeType: screenshot.mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png',
      dataUrl: stringValue(screenshot.dataUrl),
      width: numberValue(screenshot.width),
      height: numberValue(screenshot.height),
    },
    notes,
    redaction: {
      applied: redaction.applied === true,
      removedFields: Array.isArray(redaction.removedFields)
        ? redaction.removedFields.filter((item): item is string => typeof item === 'string')
        : [],
      maskedPatterns: Array.isArray(redaction.maskedPatterns)
        ? redaction.maskedPatterns.filter((item): item is string => typeof item === 'string')
        : [],
      userConfirmed: redaction.userConfirmed === true,
    },
  };
  assertEmbeddedScreenshot(migrated);
  return migrated;
}

export function migrateExportDocument(
  value: unknown,
  options: MigrationOptions = {},
): ExportDocumentV2 {
  if (!isRecord(value)) {
    throw new TypeError('검토 HTML 데이터가 올바르지 않습니다.');
  }
  if (value.schemaVersion === EXPORT_SCHEMA_VERSION) {
    const document = structuredClone(value) as unknown as ExportDocumentV2;
    if (document.source.kind === 'local-file') {
      const fileName = sanitizeLocalFileName(document.source.fileName);
      document.source = {
        kind: 'local-file',
        fileName,
        displayName: sanitizeLocalDisplayName(document.source.displayName, fileName),
      };
      document.page.title = sanitizeLocalDisplayName(document.page.title, fileName);
    }
    assertEmbeddedScreenshot(document);
    return document;
  }
  if (value.schemaVersion === 1) {
    return migrateLegacyDocument(value, options);
  }
  throw new RangeError('지원하지 않는 검토 HTML 스키마 버전입니다.');
}

export function serializeExportData(document: ExportDocumentV2): string {
  return JSON.stringify(document)
    .replaceAll('&', '\\u0026')
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

export function createRevisionFilename(document: ExportDocumentV2, revision: number): string {
  const sourceName =
    document.source.kind === 'local-file'
      ? document.source.fileName
      : document.source.displayName || 'web-review';
  const base = sourceName
    .replace(/\.html?$/i, '')
    .replace(/_rev\d+$/i, '')
    .replace(/[<>:"/\\|?*]/g, '-')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
    .join('')
    .trim();
  return `${base || 'web-review'}_rev${revision}.html`;
}
