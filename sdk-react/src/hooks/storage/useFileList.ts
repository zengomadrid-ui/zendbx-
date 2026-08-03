import { useState, useEffect, useCallback, useRef } from 'react';
import { useZendbx } from '../core/useZendbx';
import type { QueryState } from '../../types';

/**
 * File metadata interface
 */
export interface FileMetadata {
  id: string;
  name: string;
  bucket_id: string;
  file_size: number;
  mime_type?: string;
  created_at?: string;
  updated_at?: string;
  download_count?: number;
  original_name?: string;
}

/**
 * File list options
 */
export interface FileListOptions {
  search?: string;
  sortBy?: 'created_at' | 'file_size' | 'original_name' | 'download_count';
  sortDir?: 'asc' | 'desc';
  prefix?: string;
}

/**
 * useFileList - List files in storage
 *
 * Fetches list of files from a storage bucket.
 *
 * @param bucketSlug - Storage bucket slug
 * @param options - File list options
 * @returns Query state with file list
 *
 * @example
 * ```tsx
 * function FileExplorer() {
 *   const { data: files, loading, error, refetch } = useFileList('documents', {
 *     search: 'report',
 *     sortBy: 'created_at',
 *     sortDir: 'desc'
 *   });
 *
 *   if (loading) return <div>Loading files...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <button onClick={refetch}>Refresh</button>
 *       <ul>
 *         {files?.map(file => (
 *           <li key={file.id}>
 *             {file.original_name || file.name} ({file.file_size} bytes)
 *           </li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFileList(
  bucketSlug: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: FileListOptions = {}
): QueryState<FileMetadata[]> {
  const client = useZendbx();
  // Options for future implementation (filtering, sorting, etc.)
  // const { search, sortBy, sortDir, prefix } = _options;

  const [data, setData] = useState<FileMetadata[] | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const mounted = useRef(true);

  const fetchFiles = useCallback(async () => {
    try {
      setIsFetching(true);
      setError(null);

      // Fetch file list using SDK's storage API - using from() method
      const result = await client.storage.from(bucketSlug).list();

      if (!mounted.current) return;

      if (result.error) {
        throw new Error(result.error.message || 'Failed to fetch files');
      }

      // Handle different result types
      let files: FileMetadata[];
      if (Array.isArray(result.data)) {
        files = result.data;
      } else {
        files = [];
      }

      setData(files);
    } catch (err) {
      if (!mounted.current) return;

      const error = err instanceof Error ? err : new Error('Failed to fetch files');
      setError(error);
      setData(undefined);
    } finally {
      if (mounted.current) {
        setLoading(false);
        setIsFetching(false);
      }
    }
  }, [client, bucketSlug]);

  const refetch = useCallback(async () => {
    await fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Cleanup
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return {
    data,
    error,
    loading,
    isSuccess: !loading && !error && data !== undefined,
    isError: !loading && error !== null,
    isLoading: loading,
    isFetching,
    refetch,
  };
}
