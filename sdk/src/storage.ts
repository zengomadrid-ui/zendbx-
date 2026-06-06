import type { HttpClient } from './http';
import type { ZendbxResponse, StorageBucket, StorageObject } from './types';

export class StorageModule {
  constructor(private http: HttpClient) {}

  // ─── Buckets ────────────────────────────────────────────────────────────────

  /** List all storage buckets */
  async listBuckets(): Promise<ZendbxResponse<StorageBucket[]>> {
    return this.http.request<StorageBucket[]>('/api/storage/buckets');
  }

  /** Create a new bucket */
  async createBucket(
    name: string,
    options: { public?: boolean } = {}
  ): Promise<ZendbxResponse<StorageBucket>> {
    return this.http.request<StorageBucket>('/api/storage/buckets', {
      method: 'POST',
      body: { name, public: options.public ?? false },
    });
  }

  /** Delete a bucket */
  async deleteBucket(bucketId: string): Promise<ZendbxResponse<{ message: string }>> {
    return this.http.request<{ message: string }>(
      `/api/storage/buckets/${bucketId}`,
      { method: 'DELETE' }
    );
  }

  // ─── Objects ────────────────────────────────────────────────────────────────

  /**
   * Get a reference to a bucket so you can chain object operations.
   *
   * @example
   * const { data } = await zendbx.storage.from('avatars').list()
   */
  from(bucketId: string): StorageBucketRef {
    return new StorageBucketRef(this.http, bucketId);
  }
}

export class StorageBucketRef {
  constructor(
    private http: HttpClient,
    private bucketId: string
  ) {}

  /** List objects in the bucket */
  async list(prefix?: string): Promise<ZendbxResponse<StorageObject[]>> {
    const query = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
    return this.http.request<StorageObject[]>(
      `/api/storage/buckets/${this.bucketId}/objects${query}`
    );
  }

  /**
   * Upload a file. Works in both browser (File/Blob) and Node (Buffer).
   */
  async upload(
    path: string,
    file: File | Blob | ArrayBuffer | string,
    options: { contentType?: string } = {}
  ): Promise<ZendbxResponse<StorageObject>> {
    const formData = new FormData();
    const blob =
      file instanceof Blob
        ? file
        : new Blob([file as ArrayBuffer | string], { type: options.contentType ?? 'application/octet-stream' });
    formData.append('file', blob, path);

    return this.http.request<StorageObject>(
      `/api/storage/buckets/${this.bucketId}/upload`,
      {
        method: 'POST',
        body: formData as unknown as Record<string, unknown>,
        headers: {},  // Let the browser set Content-Type for multipart
      }
    );
  }

  /** Get the public URL for an object */
  getPublicUrl(path: string): string {
    return `${this.http.baseUrl}/api/storage/buckets/${this.bucketId}/objects/${encodeURIComponent(path)}`;
  }

  /** Delete an object */
  async remove(path: string): Promise<ZendbxResponse<{ message: string }>> {
    return this.http.request<{ message: string }>(
      `/api/storage/buckets/${this.bucketId}/objects/${encodeURIComponent(path)}`,
      { method: 'DELETE' }
    );
  }
}
