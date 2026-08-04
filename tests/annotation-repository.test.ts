import { describe, expect, it } from 'vitest';

import { AnnotationRepository } from '../storage/annotation-repository';
import { MemoryStorageAdapter, type StorageAdapter } from '../storage/storage-adapter';
import { STORAGE_KEY } from '../storage/storage-schema';
import type { CreateAnnotationInput } from '../types/annotation';
import type { RepositoryResult } from '../types/storage';

function unwrap<T>(result: RepositoryResult<T>): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.data;
}

function pointInput(originalUrl = 'https://example.com/docs?page=1'): CreateAnnotationInput {
  return {
    type: 'point',
    originalUrl,
    pageTitle: '문서',
    content: '위치 메모',
    author: '연구원',
    color: 'yellow',
    position: { xRatio: 0.2, yRatio: 0.4 },
  };
}

function createRepository(storage: StorageAdapter = new MemoryStorageAdapter()) {
  let currentTime = Date.parse('2026-08-04T00:00:00.000Z');
  let id = 0;
  return {
    storage,
    repository: new AnnotationRepository(storage, {
      clock: () => new Date(currentTime),
      idFactory: () => `annotation-${++id}`,
    }),
    tick: () => {
      currentTime += 1_000;
    },
  };
}

describe('AnnotationRepository', () => {
  it('세 가지 유형을 생성하고 조회한 뒤 최신순으로 정렬한다', async () => {
    const { repository, tick } = createRepository();
    const point = unwrap(await repository.create(pointInput()));
    tick();
    const text = unwrap(
      await repository.create({
        type: 'text',
        originalUrl: 'https://example.com/docs?page=1&utm_source=test',
        pageTitle: '문서',
        content: '텍스트 메모',
        author: '',
        color: 'blue',
        anchor: {
          exactText: '선택 문장',
          prefixText: '앞 문맥',
          suffixText: '뒤 문맥',
          cssSelector: 'main > p:nth-child(2)',
          startOffset: 0,
          endOffset: 5,
        },
      }),
    );
    tick();
    const area = unwrap(
      await repository.create({
        type: 'area',
        originalUrl: 'https://example.com/other',
        pageTitle: '다른 문서',
        content: '영역 메모',
        author: '검토자',
        color: 'red',
        position: { xRatio: 0.1, yRatio: 0.1, widthRatio: 0.3, heightRatio: 0.2 },
      }),
    );

    expect(unwrap(await repository.getAll()).map(({ id }) => id)).toEqual([
      area.id,
      text.id,
      point.id,
    ]);
    expect(unwrap(await repository.getByPage('https://example.com/docs?page=1&fbclid=x'))).toEqual([
      text,
      point,
    ]);
    expect(unwrap(await repository.getById(text.id))).toEqual(text);
  });

  it('메모를 수정하고 상태를 변경하고 삭제한다', async () => {
    const { repository, tick } = createRepository();
    const created = unwrap(await repository.create(pointInput()));
    tick();

    const updated = unwrap(
      await repository.update(created.id, { content: '수정한 내용', color: 'green' }),
    );
    expect(updated).toMatchObject({ content: '수정한 내용', color: 'green', status: 'open' });
    expect(updated.updatedAt).not.toBe(created.updatedAt);

    const resolved = unwrap(await repository.setStatus(created.id, 'resolved'));
    expect(resolved.status).toBe('resolved');
    expect(unwrap(await repository.delete(created.id))).toBe(true);
    expect(unwrap(await repository.getById(created.id))).toBeNull();
  });

  it('페이지별, 기간별, 일괄, 전체 삭제를 지원한다', async () => {
    const { repository, storage, tick } = createRepository();
    const first = unwrap(await repository.create(pointInput('https://example.com/a')));
    tick();
    const second = unwrap(await repository.create(pointInput('https://example.com/a')));
    tick();
    const third = unwrap(await repository.create(pointInput('https://example.com/b')));

    expect(unwrap(await repository.deleteMany([first.id]))).toBe(1);
    expect(
      unwrap(await repository.deleteByPeriod({ from: second.createdAt, to: second.createdAt })),
    ).toBe(1);
    expect(unwrap(await repository.deleteByPage('https://example.com/b'))).toBe(1);

    unwrap(await repository.create(pointInput()));
    expect(unwrap(await repository.deleteAllAnnotations())).toBe(1);
    unwrap(await repository.create(pointInput()));
    unwrap(await repository.deleteAllData());
    expect((await storage.get(STORAGE_KEY))[STORAGE_KEY]).toBeUndefined();
    expect(unwrap(await repository.getAll())).toEqual([]);
    expect(third.id).toBe('annotation-3');
  });

  it('동시에 생성한 메모도 유실하지 않는다', async () => {
    const { repository } = createRepository();
    const results = await Promise.all([
      repository.create(pointInput('https://example.com/1')),
      repository.create(pointInput('https://example.com/2')),
      repository.create(pointInput('https://example.com/3')),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    expect(unwrap(await repository.getAll())).toHaveLength(3);
  });

  it('v0 데이터를 v1으로 마이그레이션한다', async () => {
    const legacy = {
      schemaVersion: 0,
      annotations: [
        {
          id: 'legacy-1',
          pageId: 'legacy-page',
          url: 'https://example.com/legacy',
          pageTitle: '이전 문서',
          type: 'point',
          body: '이전 메모',
          status: 'open',
          anchor: { ratioX: 0.25, ratioY: 0.5 },
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    };
    const storage = new MemoryStorageAdapter({ [STORAGE_KEY]: legacy });
    const { repository } = createRepository(storage);

    expect(unwrap(await repository.getAll())).toEqual([
      expect.objectContaining({
        id: 'legacy-1',
        pageKey: 'legacy-page',
        originalUrl: 'https://example.com/legacy',
        content: '이전 메모',
        color: 'yellow',
        author: '',
        position: { xRatio: 0.25, yRatio: 0.5 },
      }),
    ]);
    expect((await storage.get(STORAGE_KEY))[STORAGE_KEY]).toMatchObject({ schemaVersion: 1 });
  });

  it('잘못된 저장 레코드만 버리고 유효한 메모는 복구한다', async () => {
    const validAnnotation = {
      id: 'valid-1',
      pageKey: 'page-valid',
      originalUrl: 'https://example.com',
      pageTitle: '문서',
      type: 'point',
      content: '유효함',
      author: '',
      color: 'yellow',
      status: 'open',
      position: { xRatio: 0.2, yRatio: 0.4 },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const storage = new MemoryStorageAdapter({
      [STORAGE_KEY]: {
        schemaVersion: 1,
        settings: { defaultAuthor: 42, defaultColor: 'unknown' },
        annotations: [
          { ...validAnnotation, imageDataUrl: 'data:image/png;base64,AAAA' },
          { id: 'broken', type: 'area', position: { xRatio: 7 } },
        ],
        updatedAt: 'invalid-date',
      },
    });
    const { repository } = createRepository(storage);

    expect(unwrap(await repository.getAll())).toEqual([validAnnotation]);
    expect((await storage.get(STORAGE_KEY))[STORAGE_KEY]).toMatchObject({
      schemaVersion: 1,
      settings: { defaultAuthor: '', defaultColor: 'yellow' },
      annotations: [validAnnotation],
    });
  });

  it('저장 한도 초과 오류를 사용자 친화적으로 반환한다', async () => {
    const base = new MemoryStorageAdapter();
    const quotaStorage: StorageAdapter = {
      get: (key) => base.get(key),
      set: async () => {
        throw new Error('QUOTA_BYTES quota exceeded');
      },
      remove: (keys) => base.remove(keys),
      clear: () => base.clear(),
      getBytesInUse: (keys) => base.getBytesInUse(keys),
    };
    const { repository } = createRepository(quotaStorage);

    const result = await repository.create(pointInput());
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'quota_exceeded',
        message: expect.stringContaining('로컬 저장 공간이 부족'),
      }),
    });
  });

  it('전체 저장소의 바이트 사용량을 측정한다', async () => {
    const { repository } = createRepository();
    unwrap(await repository.create(pointInput()));

    const usage = unwrap(await repository.getUsage());
    expect(usage.bytesInUse).toBeGreaterThan(0);
    expect(usage.quotaBytes).toBe(10_485_760);
    expect(usage.level).toBe('normal');
  });
});
