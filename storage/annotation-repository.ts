import type {
  Annotation,
  AnnotationChanges,
  AnnotationStatus,
  CreateAnnotationInput,
} from '../types/annotation';
import {
  STORAGE_QUOTA_BYTES,
  type RepositoryResult,
  type StorageError,
  type StorageLoadResult,
  type StorageSettings,
  type StorageUsage,
} from '../types/storage';
import { createId, type IdFactory } from '../utils/id';
import { createPageKey, normalizeUrl } from '../utils/url-normalizer';
import type { StorageAdapter } from './storage-adapter';
import { migrateStorageData } from './storage-migration';
import {
  createEmptyStoredData,
  getStorageUsageLevel,
  isAnnotation,
  STORAGE_KEY,
} from './storage-schema';

export type Clock = () => Date;

export interface AnnotationRepositoryOptions {
  clock?: Clock;
  idFactory?: IdFactory;
  quotaBytes?: number;
}

export interface DeletePeriod {
  from?: string;
  to?: string;
}

const byNewestFirst = (left: Annotation, right: Annotation): number => {
  const timeDifference = Date.parse(right.createdAt) - Date.parse(left.createdAt);
  return timeDifference === 0 ? right.id.localeCompare(left.id) : timeDifference;
};

function success<T>(data: T): RepositoryResult<T> {
  return { ok: true, data };
}

function failure<T>(error: StorageError): RepositoryResult<T> {
  return { ok: false, error };
}

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /quota|QUOTA_BYTES|MAX_WRITE_OPERATIONS/i.test(message);
}

function toStorageError(error: unknown): StorageError {
  if (error instanceof RangeError) {
    return {
      code: 'unsupported_schema',
      message: error.message,
      cause: error,
    };
  }

  if (isQuotaError(error)) {
    return {
      code: 'quota_exceeded',
      message:
        '로컬 저장 공간이 부족해 메모를 저장하지 못했습니다. 오래된 데이터를 정리한 뒤 다시 시도해 주세요.',
      cause: error,
    };
  }

  return {
    code: 'storage_unavailable',
    message: '로컬 저장소에 접근하지 못했습니다. 확장 프로그램을 다시 열고 시도해 주세요.',
    cause: error,
  };
}

function invalidInput(message: string): StorageError {
  return { code: 'invalid_input', message };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class AnnotationRepository {
  private readonly clock: Clock;
  private readonly idFactory: IdFactory;
  private readonly quotaBytes: number;
  private mutationQueue: Promise<void> = Promise.resolve();

  public constructor(
    private readonly storage: StorageAdapter,
    options: AnnotationRepositoryOptions = {},
  ) {
    this.clock = options.clock ?? (() => new Date());
    this.idFactory = options.idFactory ?? createId;
    this.quotaBytes = options.quotaBytes ?? STORAGE_QUOTA_BYTES;
  }

  public async create(input: CreateAnnotationInput): Promise<RepositoryResult<Annotation>> {
    return this.mutate(async (loaded) => {
      if (input.content.trim().length === 0) {
        return failure(invalidInput('메모 내용을 입력해 주세요.'));
      }

      let normalizedUrl: string;
      try {
        normalizedUrl = normalizeUrl(input.originalUrl);
      } catch (error) {
        return failure(
          invalidInput(error instanceof Error ? error.message : 'URL이 올바르지 않습니다.'),
        );
      }

      const now = this.clock().toISOString();
      const base = {
        id: this.idFactory(),
        pageKey: createPageKey(normalizedUrl),
        originalUrl: input.originalUrl,
        pageTitle: input.pageTitle,
        content: input.content,
        author: input.author,
        color: input.color,
        status: input.status ?? ('open' as const),
        createdAt: now,
        updatedAt: now,
      };
      const annotation: Annotation =
        input.type === 'text'
          ? { ...base, type: 'text', anchor: clone(input.anchor) }
          : input.type === 'area'
            ? { ...base, type: 'area', position: clone(input.position) }
            : { ...base, type: 'point', position: clone(input.position) };

      if (!isAnnotation(annotation)) {
        return failure(
          invalidInput('메모 데이터가 올바르지 않습니다. 위치 비율과 필수 항목을 확인해 주세요.'),
        );
      }

      if (loaded.data.annotations.some(({ id }) => id === annotation.id)) {
        return failure(invalidInput('메모 식별자가 중복되었습니다. 다시 시도해 주세요.'));
      }

      loaded.data.annotations.push(annotation);
      loaded.data.updatedAt = now;
      await this.save(loaded);
      return success(clone(annotation));
    });
  }

  public async getById(id: string): Promise<RepositoryResult<Annotation | null>> {
    return this.read(async (loaded) => {
      const annotation = loaded.data.annotations.find((item) => item.id === id);
      return success(annotation === undefined ? null : clone(annotation));
    });
  }

  public async getByPage(url: string): Promise<RepositoryResult<Annotation[]>> {
    let pageKey: string;
    try {
      pageKey = createPageKey(url);
    } catch (error) {
      return failure(
        invalidInput(error instanceof Error ? error.message : 'URL이 올바르지 않습니다.'),
      );
    }

    return this.read(async (loaded) =>
      success(
        loaded.data.annotations
          .filter((annotation) => annotation.pageKey === pageKey)
          .sort(byNewestFirst)
          .map(clone),
      ),
    );
  }

  public async getAll(): Promise<RepositoryResult<Annotation[]>> {
    return this.read(async (loaded) =>
      success(loaded.data.annotations.toSorted(byNewestFirst).map(clone)),
    );
  }

  public async update(
    id: string,
    changes: AnnotationChanges,
  ): Promise<RepositoryResult<Annotation>> {
    return this.mutate(async (loaded) => {
      if (changes.content !== undefined && changes.content.trim().length === 0) {
        return failure(invalidInput('메모 내용을 입력해 주세요.'));
      }

      const index = loaded.data.annotations.findIndex((annotation) => annotation.id === id);
      const current = loaded.data.annotations[index];
      if (current === undefined) {
        return failure({ code: 'not_found', message: '수정할 메모를 찾지 못했습니다.' });
      }

      const updated = {
        ...current,
        pageTitle: changes.pageTitle ?? current.pageTitle,
        content: changes.content ?? current.content,
        author: changes.author ?? current.author,
        color: changes.color ?? current.color,
        status: changes.status ?? current.status,
        updatedAt: this.clock().toISOString(),
      } as Annotation;

      if (!isAnnotation(updated)) {
        return failure(invalidInput('수정할 메모 데이터가 올바르지 않습니다.'));
      }

      loaded.data.annotations[index] = updated;
      loaded.data.updatedAt = updated.updatedAt;
      await this.save(loaded);
      return success(clone(updated));
    });
  }

  public setStatus(id: string, status: AnnotationStatus): Promise<RepositoryResult<Annotation>> {
    return this.update(id, { status });
  }

  public async getSettings(): Promise<RepositoryResult<StorageSettings>> {
    return this.read(async (loaded) => success(clone(loaded.data.settings)));
  }

  public async updateSettings(
    changes: Partial<StorageSettings>,
  ): Promise<RepositoryResult<StorageSettings>> {
    return this.mutate(async (loaded) => {
      const settings = { ...loaded.data.settings, ...changes };
      const now = this.clock().toISOString();
      loaded.data.settings = settings;
      loaded.data.updatedAt = now;
      await this.save(loaded);
      return success(clone(settings));
    });
  }

  public async delete(id: string): Promise<RepositoryResult<boolean>> {
    return this.deleteMatching((annotation) => annotation.id === id);
  }

  public async deleteMany(ids: readonly string[]): Promise<RepositoryResult<number>> {
    const idSet = new Set(ids);
    return this.deleteMatching((annotation) => idSet.has(annotation.id), true);
  }

  public async deleteByPage(url: string): Promise<RepositoryResult<number>> {
    let pageKey: string;
    try {
      pageKey = createPageKey(url);
    } catch (error) {
      return failure(
        invalidInput(error instanceof Error ? error.message : 'URL이 올바르지 않습니다.'),
      );
    }
    return this.deleteMatching((annotation) => annotation.pageKey === pageKey, true);
  }

  public async deleteByPeriod(period: DeletePeriod): Promise<RepositoryResult<number>> {
    const from = period.from === undefined ? Number.NEGATIVE_INFINITY : Date.parse(period.from);
    const to = period.to === undefined ? Number.POSITIVE_INFINITY : Date.parse(period.to);

    if (Number.isNaN(from) || Number.isNaN(to) || from > to) {
      return failure(
        invalidInput('삭제 기간이 올바르지 않습니다. 시작일과 종료일을 확인해 주세요.'),
      );
    }

    return this.deleteMatching((annotation) => {
      const createdAt = Date.parse(annotation.createdAt);
      return createdAt >= from && createdAt <= to;
    }, true);
  }

  public async deleteAllAnnotations(): Promise<RepositoryResult<number>> {
    return this.deleteMatching(() => true, true);
  }

  public async deleteAllData(): Promise<RepositoryResult<void>> {
    return this.enqueue(async () => {
      try {
        await this.storage.remove(STORAGE_KEY);
        return success(undefined);
      } catch (error) {
        return failure(toStorageError(error));
      }
    });
  }

  public async getUsage(): Promise<RepositoryResult<StorageUsage>> {
    try {
      const bytesInUse = await this.storage.getBytesInUse(null);
      const ratio = this.quotaBytes > 0 ? bytesInUse / this.quotaBytes : 1;
      return success({
        measuredAt: this.clock().toISOString(),
        bytesInUse,
        quotaBytes: this.quotaBytes,
        ratio,
        level: getStorageUsageLevel(ratio),
      });
    } catch (error) {
      return failure(toStorageError(error));
    }
  }

  private async deleteMatching(
    predicate: (annotation: Annotation) => boolean,
    returnCount: true,
  ): Promise<RepositoryResult<number>>;
  private async deleteMatching(
    predicate: (annotation: Annotation) => boolean,
    returnCount?: false,
  ): Promise<RepositoryResult<boolean>>;
  private async deleteMatching(
    predicate: (annotation: Annotation) => boolean,
    returnCount = false,
  ): Promise<RepositoryResult<number | boolean>> {
    return this.mutate(async (loaded) => {
      const retained = loaded.data.annotations.filter((annotation) => !predicate(annotation));
      const deletedCount = loaded.data.annotations.length - retained.length;
      if (deletedCount > 0) {
        loaded.data.annotations = retained;
        loaded.data.updatedAt = this.clock().toISOString();
        await this.save(loaded);
      }
      return success(returnCount ? deletedCount : deletedCount > 0);
    });
  }

  private async load(): Promise<StorageLoadResult> {
    const values = await this.storage.get(STORAGE_KEY);
    return migrateStorageData(values[STORAGE_KEY], this.clock().toISOString());
  }

  private async save(loaded: StorageLoadResult): Promise<void> {
    await this.storage.set({ [STORAGE_KEY]: loaded.data });
  }

  private async read<T>(
    operation: (loaded: StorageLoadResult) => Promise<RepositoryResult<T>>,
  ): Promise<RepositoryResult<T>> {
    return this.enqueue(async () => {
      try {
        const loaded = await this.load();
        if (loaded.recovery.migrated) {
          await this.save(loaded);
        }
        return await operation(loaded);
      } catch (error) {
        return failure(toStorageError(error));
      }
    });
  }

  private mutate<T>(
    operation: (loaded: StorageLoadResult) => Promise<RepositoryResult<T>>,
  ): Promise<RepositoryResult<T>> {
    return this.enqueue(async () => {
      try {
        const loaded = await this.load();
        return await operation(loaded);
      } catch (error) {
        return failure(toStorageError(error));
      }
    });
  }

  private enqueue<T>(operation: () => Promise<RepositoryResult<T>>): Promise<RepositoryResult<T>> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

export function createEmptyRepositoryData(now = new Date().toISOString()) {
  return createEmptyStoredData(now);
}
