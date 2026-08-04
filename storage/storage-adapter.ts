export type StorageValues = Record<string, unknown>;

export interface StorageAdapter {
  get(key: string | null): Promise<StorageValues>;
  set(values: StorageValues): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
  getBytesInUse(keys: string | string[] | null): Promise<number>;
}

interface ChromeStorageAreaLike {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
  getBytesInUse(keys?: string | string[] | null): Promise<number>;
}

export class ChromeStorageAdapter implements StorageAdapter {
  public constructor(private readonly storageArea: ChromeStorageAreaLike) {}

  public static fromLocal(): ChromeStorageAdapter {
    const chromeApi = (globalThis as { chrome?: { storage?: { local?: ChromeStorageAreaLike } } })
      .chrome;
    const storageArea = chromeApi?.storage?.local;
    if (storageArea === undefined) {
      throw new Error('Chrome 로컬 저장소 API를 사용할 수 없습니다.');
    }
    return new ChromeStorageAdapter(storageArea);
  }

  public get(key: string | null): Promise<StorageValues> {
    return this.storageArea.get(key);
  }

  public set(values: StorageValues): Promise<void> {
    return this.storageArea.set(values);
  }

  public remove(keys: string | string[]): Promise<void> {
    return this.storageArea.remove(keys);
  }

  public clear(): Promise<void> {
    return this.storageArea.clear();
  }

  public getBytesInUse(keys: string | string[] | null): Promise<number> {
    return this.storageArea.getBytesInUse(keys);
  }
}

export class MemoryStorageAdapter implements StorageAdapter {
  private values: StorageValues;

  public constructor(initialValues: StorageValues = {}) {
    this.values = structuredClone(initialValues);
  }

  public async get(key: string | null): Promise<StorageValues> {
    if (key === null) {
      return structuredClone(this.values);
    }

    return key in this.values ? { [key]: structuredClone(this.values[key]) } : {};
  }

  public async set(values: StorageValues): Promise<void> {
    Object.assign(this.values, structuredClone(values));
  }

  public async remove(keys: string | string[]): Promise<void> {
    for (const key of typeof keys === 'string' ? [keys] : keys) {
      delete this.values[key];
    }
  }

  public async clear(): Promise<void> {
    this.values = {};
  }

  public async getBytesInUse(keys: string | string[] | null): Promise<number> {
    const selectedKeys =
      keys === null ? Object.keys(this.values) : typeof keys === 'string' ? [keys] : keys;
    const selectedValues = Object.fromEntries(
      selectedKeys.filter((key) => key in this.values).map((key) => [key, this.values[key]]),
    );

    return new TextEncoder().encode(JSON.stringify(selectedValues)).byteLength;
  }
}
