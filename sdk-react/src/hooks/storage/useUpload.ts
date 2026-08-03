import { useState, useCallback, useRef, useEffect } from 'react';
import { useZendbx } from '../core/useZendbx';
import type { UploadProgress, UploadOptions } from '../../types';

/**
 * Upload state interface
 */
export interface UploadState {
  data: unknown;
  error: Error | null;
  loading: boolean;
  progress: UploadProgress | null;
  upload: (bucketSlug: string, file: File, filename?: string) => Promise<unknown>;
  reset: () => void;
}

/**
 * useUpload - File upload hook
 *
 * Uploads files to storage with progress tracking.
 *
 * @param options - Upload options
 * @returns Upload state with upload function
 *
 * @example
 * ```tsx
 * function FileUploader() {
 *   const { upload, loading, progress, error, data } = useUpload({
 *     onProgress: (progress) => {
 *       console.log(`${progress.percentage}% uploaded`);
 *     },
 *     onSuccess: (data) => {
 *       console.log('Upload complete:', data);
 *     }
 *   });
 *
 *   const handleFileChange = (e) => {
 *     const file = e.target.files[0];
 *     if (file) {
 *       upload('avatars', file, file.name);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={handleFileChange} disabled={loading} />
 *       {loading && <div>Uploading: {progress?.percentage}%</div>}
 *       {error && <div>Error: {error.message}</div>}
 *       {data && <div>Upload complete!</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useUpload(
  options: UploadOptions = {}
): UploadState {
  const client = useZendbx();
  const { onProgress, onSuccess, onError } = options;

  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const mounted = useRef(true);

  const upload = useCallback(
    async (bucketSlug: string, file: File, filename?: string): Promise<unknown> => {
      try {
        setLoading(true);
        setError(null);
        setProgress({ loaded: 0, total: file.size, percentage: 0 });

        // Simulate progress if not natively supported
        const progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (!prev || prev.percentage >= 95) return prev;
            const newPercentage = Math.min(prev.percentage + 5, 95);
            const newLoaded = (file.size * newPercentage) / 100;
            const newProgress = {
              loaded: newLoaded,
              total: file.size,
              percentage: newPercentage,
            };
            if (onProgress) {
              onProgress(newProgress);
            }
            return newProgress;
          });
        }, 200);

        // Upload file using SDK's storage API - using from() method
        const result = await client.storage.from(bucketSlug).upload(
          filename || file.name,
          file,
          { contentType: file.type }
        );

        clearInterval(progressInterval);

        if (!mounted.current) return;

        if (result.error) {
          throw new Error(result.error.message || 'Upload failed');
        }

        // Complete progress
        const finalProgress = { loaded: file.size, total: file.size, percentage: 100 };
        setProgress(finalProgress);
        if (onProgress) {
          onProgress(finalProgress);
        }

        setData(result.data);

        if (onSuccess) {
          onSuccess(result.data);
        }

        return result.data;
      } catch (err) {
        if (!mounted.current) return;

        const error = err instanceof Error ? err : new Error('Upload failed');
        setError(error);
        setProgress(null);

        if (onError) {
          onError(error);
        }

        throw error;
      } finally {
        if (mounted.current) {
          setLoading(false);
        }
      }
    },
    [client, onProgress, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
    setProgress(null);
  }, []);

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
    progress,
    upload,
    reset,
  };
}
