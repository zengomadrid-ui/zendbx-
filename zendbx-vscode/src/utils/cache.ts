export class Cache {
  private static instance: Cache;
  private cache: Map<string, { value: unknown; timestamp: number }>;
  private readonly DEFAULT_TTL = 5 * 60 * 1000;

  private constructor() {
    this.cache = new Map();
  }

  static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache();
    }
    return Cache.instance;
  }

  set<T>(key: string, value: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now() + ttl,
    });
  }

  get<T>(key: string): T | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    if (Date.now() > cached.timestamp) {
      this.cache.delete(key);
      return null;
    }

    return cached.value as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const cached = this.cache.get(key);

    if (!cached) {
      return false;
    }

    if (Date.now() > cached.timestamp) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }
}
