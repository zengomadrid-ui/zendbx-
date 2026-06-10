/**
 * Storage Module — ZendBX Storage Architecture V3
 *
 * Project-scoped, bucket-slug based. No UUIDs or project IDs in client code.
 *
 * @example
 * const storage = client.storage.bucket('resumes');
 * await storage.upload(file, 'resume.pdf');
 * await storage.list();
 * await storage.download('resume.pdf');
 * await storage.delete('resume.pdf');
 * const { data } = await storage.createSignedUrl('resume.pdf');
 */
import type { HttpClient } from './http';
import type {
  ZendbxResponse,
  StorageBucket,
  StorageObject,
  StorageUploadResult,
  StorageSignedUrl,
  StorageAnalytics,
} from './types';

export class StorageModule {
  constructor(
    private http: HttpClient,
    private projectSlug: string,
  ) {}

  /** Base path for all storage requests on this project. */
  private get basePath(): string {
    return `/p/${this.projectSlug}/storage`;
  }

  // ── Bucket Management ──────────────────────────────────────────────────

  /** List all buckets in this project. */
  async listBuckets(): Promise<ZendbxResponse<StorageBucket[]>> {
    return this.http.request<StorageBucket[]>(`${this.basePath}/buckets`);
  }

  /** Create a new bucket. */
  async createBucket(
    name: string,
    options: { description?: string; isPublic?: boolean } = {},
  ): Promise<ZendbxResponse<StorageBucket>> {
    return this.http.request<StorageBucket>(`${this.basePath}/buckets`, {
      method: 'POST',
      body: {
        name,
        description: options.description,
        is_public: options.isPublic ?? false,
      },
    });
  }

  /** Update a bucket. Accepts slug or UUID. */
  async updateBucket(
    bucketSlug: string,
    updates: { name?: string; description?: string; isPublic?: boolean },
  ): Promise<ZendbxResponse<{ success: boolean; name: string; slug: string }>> {
    return this.http.request(`${this.basePath}/buckets/${bucketSlug}`, {
      method: 'PATCH',
      body: {
        name: updates.name,
        description: updates.description,
        is_public: updates.isPublic,
      },
    });
  }

  /** Delete a bucket and all its files. Accepts slug or UUID. */
  async deleteBucket(
    bucketSlug: string,
  ): Promise<ZendbxResponse<{ success: boolean }>> {
    return this.http.request(`${this.basePath}/buckets/${bucketSlug}`, {
      method: 'DELETE',
    });
  }

  /** Get detailed statistics for a bucket. */
  async bucketStats(
    bucketSlug: string,
  ): Promise<ZendbxResponse<{ bucket_id: string; name: string; storage_used: number; file_count: number; largest_files: StorageObject[] }>> {
    return this.http.request(`${this.basePath}/buckets/${bucketSlug}/stats`);
  }

  /** Get storage analytics for the project. */
  async analytics(): Promise<ZendbxResponse<StorageAnalytics>> {
    return this.http.request<StorageAnalytics>(`${this.basePath}/analytics`);
  }

  /**
   * Get a reference to a specific bucket for file operations.
   * This is the primary SDK entry point — use bucket slugs, never UUIDs.
   *
   * @example
   * const bucket = client.storage.bucket('avatars');
   * await bucket.upload(file, 'user-123.png');
   */
  bucket(slug: string): StorageBucketRef {
    return new StorageBucketRef(this.http, this.basePath, slug);
  }
}

export class StorageBucketRef {
  constructor(
    private http: HttpClient,
    private basePath: string,
    private slug: string,
  ) {}

  // ── Files ────────────────────────────────────────────────────────────────

  /**
   * List files in this bucket.
   *
   * @example
   * const { data } = await bucket.list();
   * const { data } = await bucket.list({ search: 'resume', sortBy: 'file_size' });
   */
  async list(options: {
    search?: string;
    sortBy?: 'created_at' | 'file_size' | 'original_name' | 'download_count';
    sortDir?: 'asc' | 'desc';
    prefix?: string;
  } = {}): Promise<ZendbxResponse<StorageObject[]>> {
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.sortBy) params.set('sort_by', options.sortBy);
    if (options.sortDir) params.set('sort_dir', options.sortDir);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.http.request<StorageObject[]>(
      `${this.basePath}/buckets/${this.slug}/files${qs}`,
    );
  }

  /**
   * Upload a file to this bucket.
   *
   * Works in browser (File/Blob) and Node.js (Buffer/ArrayBuffer).
   *
   * @example
   * // Browser
   * const file = event.target.files[0];
   * const { data } = await bucket.upload(file);
   *
   * // Node.js
   * const buffer = fs.readFileSync('./resume.pdf');
   * const { data } = await bucket.upload(buffer, 'resume.pdf', { contentType: 'application/pdf' });
   */
  async upload(
    file: File | Blob | ArrayBuffer | Uint8Array | ArrayBufferView,
    filename?: string,
    options: { contentType?: string } = {},
  ): Promise<ZendbxResponse<StorageUploadResult>> {
    const formData = new FormData();

    let blob: Blob;
    if (file instanceof Blob) {
      blob = file;
    } else {
      // ArrayBuffer / Uint8Array / ArrayBufferView
      blob = new Blob([file], {
        type: options.contentType ?? 'application/octet-stream',
      });
    }

    const name =
      filename ??
      (file instanceof File ? file.name : `upload-${Date.now()}`);

    formData.append('file', blob, name);

    return this.http.requestFormData<StorageUploadResult>(
      `${this.basePath}/buckets/${this.slug}/upload`,
      formData,
    );
  }

  /**
   * Download a file by its ID.
   *
   * @example
   * const { data } = await bucket.download('file-uuid');
   */
  async download(fileId: string): Promise<Response> {
    return this.http.requestRaw(
      `${this.basePath}/files/${fileId}/download`,
    );
  }

  /**
   * Get file metadata by ID.
   */
  async getFile(fileId: string): Promise<ZendbxResponse<StorageObject>> {
    return this.http.request<StorageObject>(
      `${this.basePath}/files/${fileId}`,
    );
  }

  /**
   * Delete a file by its ID.
   *
   * @example
   * await bucket.delete('file-uuid');
   */
  async delete(fileId: string): Promise<ZendbxResponse<{ success: boolean }>> {
    return this.http.request<{ success: boolean }>(
      `${this.basePath}/files/${fileId}`,
      { method: 'DELETE' },
    );
  }

  /**
   * Delete multiple files at once.
   */
  async bulkDelete(
    fileIds: string[],
  ): Promise<ZendbxResponse<{ success: boolean; deleted: number }>> {
    return this.http.request<{ success: boolean; deleted: number }>(
      `${this.basePath}/files/bulk-delete`,
      { method: 'POST', body: { file_ids: fileIds } },
    );
  }

  /**
   * Generate a temporary signed URL for a file.
   *
   * @param fileId - The file UUID
   * @param expiry - Duration: '5m' | '15m' | '1h' | '24h' | '7d'
   *
   * @example
   * const { data } = await bucket.createSignedUrl('file-uuid', '1h');
   * console.log(data.url); // Temporary access URL
   */
  async createSignedUrl(
    fileId: string,
    expiry: '5m' | '15m' | '1h' | '24h' | '7d' = '1h',
  ): Promise<ZendbxResponse<StorageSignedUrl>> {
    return this.http.request<StorageSignedUrl>(
      `${this.basePath}/files/${fileId}/signed-url`,
      { method: 'POST', body: { expiry } },
    );
  }

  /**
   * Get the public preview URL for a file.
   * Only works for files in public buckets.
   */
  getPreviewUrl(fileId: string): string {
    return `${this.http.baseUrl}${this.basePath}/files/${fileId}/preview`;
  }
}
