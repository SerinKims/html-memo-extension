import { describe, expect, it } from 'vitest';

import {
  createExportDocument,
  createRevisionFilename,
  migrateExportDocument,
  serializeExportData,
} from '../export/export-document';
import { generateReviewHtml } from '../export/review-html';
import type { PointAnnotation } from '../types/annotation';

const pointAnnotation: PointAnnotation = {
  id: 'note-1',
  pageKey: 'private-page-key',
  originalUrl: 'file:///C:/Users/researcher/secret/report.html',
  pageTitle: '로컬 보고서',
  type: 'point',
  content: '확인 필요',
  author: '연구원',
  color: 'yellow',
  status: 'open',
  position: { xRatio: 0.25, yRatio: 0.5 },
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
};

function createLocalExport() {
  return createExportDocument({
    sourceUrl: 'file:///C:/Users/researcher/secret/report.html?draft=1#section',
    pageTitle: '로컬 보고서',
    capturedAt: '2026-08-04T00:00:00.000Z',
    exportedAt: '2026-08-04T01:00:00.000Z',
    documentId: 'document-1',
    documentWidth: 1200,
    documentHeight: 2400,
    screenshot: {
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,AAAA',
      width: 1200,
      height: 2400,
    },
    annotations: [pointAnnotation],
    redaction: {
      applied: true,
      removedFields: ['page.source.path'],
      maskedPatterns: [],
      userConfirmed: true,
    },
    generatorVersion: '0.1.0',
  });
}

describe('export document v2', () => {
  it('로컬 파일 전체 경로를 source와 메모에서 제거한다', () => {
    const document = createLocalExport();

    expect(document.source).toEqual({
      kind: 'local-file',
      displayName: '로컬 보고서',
      fileName: 'report.html',
    });
    expect(document.notes[0]).not.toHaveProperty('originalUrl');
    expect(JSON.stringify(document)).not.toContain('C:/Users/researcher');
    expect(document.notes[0]).toMatchObject({ type: 'point', origin: 'capture' });
  });

  it('로컬 문서 제목 또는 v2 fileName으로 전달된 경로도 제거한다', () => {
    const document = createLocalExport();
    document.source = {
      kind: 'local-file',
      displayName: 'C:\\Users\\researcher\\secret\\report.html',
      fileName: 'C:\\Users\\researcher\\secret\\report.html',
    };
    document.page.title = 'file:///C:/Users/researcher/secret/report.html';

    const html = generateReviewHtml(document);
    expect(html).not.toContain('Users');
    expect(html).not.toContain('researcher');
    expect(html).toContain('"fileName":"report.html"');
  });

  it('외부 URL 스크린샷은 검토 HTML로 생성하지 않는다', () => {
    const document = createLocalExport();
    document.screenshot.dataUrl = 'https://example.com/private.png';

    expect(() => generateReviewHtml(document)).toThrow(
      '스크린샷은 Base64 PNG 또는 JPEG 데이터 URL이어야 합니다.',
    );
  });

  it('v1 문서를 v2로 변환하면서 기존 메모와 스크린샷을 보존한다', () => {
    const migrated = migrateExportDocument(
      {
        schemaVersion: 1,
        exportedAt: '2026-07-31T00:00:00.000Z',
        generator: { version: '0.1.0' },
        page: {
          url: 'file:///C:/private/%EB%B3%B4%EA%B3%A0%EC%84%9C.html',
          title: '이전 검토',
          capturedAt: '2026-07-30T00:00:00.000Z',
          documentWidth: 800,
          documentHeight: 1600,
        },
        screenshot: {
          mimeType: 'image/png',
          dataUrl: 'data:image/png;base64,BBBB',
          width: 800,
          height: 1600,
        },
        notes: [
          {
            id: 'legacy-1',
            type: 'area',
            body: '이전 메모',
            anchor: {
              rect: { ratioX: 0.1, ratioY: 0.2, ratioWidth: 0.3, ratioHeight: 0.4 },
            },
          },
        ],
        redaction: { applied: false, removedFields: [], maskedPatterns: [], userConfirmed: false },
      },
      { documentId: 'migrated-document', now: '2026-08-04T00:00:00.000Z' },
    );

    expect(migrated).toMatchObject({ schemaVersion: 2, revision: 1 });
    expect(migrated.source).toEqual({
      kind: 'local-file',
      displayName: '이전 검토',
      fileName: '보고서.html',
    });
    expect(migrated.notes[0]).toMatchObject({
      id: 'legacy-1',
      type: 'area',
      content: '이전 메모',
      position: { xRatio: 0.1, yRatio: 0.2, widthRatio: 0.3, heightRatio: 0.4 },
    });
  });

  it('JSON script 종료 문자열과 HTML 문자를 안전하게 이스케이프한다', () => {
    const document = createLocalExport();
    document.notes[0]!.content = '</script><script>alert("xss")</script>&';

    const serialized = serializeExportData(document);
    expect(serialized).not.toContain('</script>');
    expect(JSON.parse(serialized).notes[0].content).toBe('</script><script>alert("xss")</script>&');
  });

  it('수정본 파일명에서 기존 revision 접미사를 교체한다', () => {
    const document = createLocalExport();
    document.source = {
      kind: 'local-file',
      displayName: '보고서',
      fileName: '보고서_rev2.html',
    };

    expect(createRevisionFilename(document, 3)).toBe('보고서_rev3.html');
  });
});

describe('editable review HTML', () => {
  it('외부 리소스 없이 v2 마커와 편집·수정본 다운로드 UI를 포함한다', () => {
    const html = generateReviewHtml(createLocalExport());

    expect(html).toContain('<meta name="html-memo-export" content="2">');
    expect(html).toContain('data-tool="point"');
    expect(html).toContain('data-tool="area"');
    expect(html).toContain('data-tool="comment"');
    expect(html).toContain('id="download-revision"');
    expect(html).not.toMatch(/<(?:script|link|img)[^>]+(?:src|href)=["']https?:/i);
    expect(html).not.toContain('C:/Users/researcher');
  });

  it('생성된 인라인 편집 스크립트가 유효한 JavaScript다', () => {
    const html = generateReviewHtml(createLocalExport());
    const scripts = [...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)];
    const viewerScript = scripts.at(-1)?.[1];

    expect(viewerScript).toBeDefined();
    expect(() => Function(viewerScript ?? '')).not.toThrow();
  });
});
