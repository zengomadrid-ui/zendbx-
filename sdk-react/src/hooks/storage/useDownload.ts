import { useState, useCallback, useRef, useEffect } from 'react';
import { useZendbx } from '../core/useZendbx';

/**
 * Download state interface
 */
export interface DownloadState {
  data: Blob | null;
  url: string | null;
  error: Error | null;
  loading: boolean;
  download: (bucketSlug: string, fileId: string) => Promise<void>;
  reset: () => void;
}

/**
 * Download options
 */
export interface DownloadOptions {
  onSuccess?: (data: Blob) => void;
  onError?: (error: Error) => void;
}

/**
 * useDownload - File download hook
 *
 * Downloads files from storage.
 *
 * @param options - Download options
 * @returns Download state with download function
 *
 * @example
 * ```tsx
 * function FileDownloader({ filePath }) {
 *   const { download, loading, error, url } = useDownload({
 *     onSuccess: (blob) => {
 *       console.log('Downloaded:', blob);
 *     }
 *   });
 *
 *   const handleDownload = () => {
 *     download('documents', 'file-id-123');
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleDownload} disabled={loading}>
 *         {loading ? 'Downloading...' : 'Download File'}
 *       </button>
 *       {url && <a href={url} download>Save File</a>}
 *       {error && <div>Error: {error.message}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDownload(
  options: DownloadOptions = {}
): DownloadState {
  const client = useZendbx();
  const { onSuccess, onError } = options;

  const [data, setData] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const mounted = useRef(true);
  const urlRef = useRef<string | null>(null);

  const download = useCallback(
    async (bucketSlug: string, fileId: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        // Download file using SDK's storage API - using from() method
        const result = await client.storage.from(bucketSlug).download(fileId);

        if (!mounted.current) return;

        // Handle response
        let blob: Blob;
        if (result instanceof Response) {
          blob = await result.blob();
        } else if (result instanceof Blob) {
          blob = result;
        } else if (result.data instanceof Blob) {
          blob = result.data;
        } else {
          throw new Error('Invalid download response');
        }

        setData(blob);

        // Create blob URL
        const blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
        urlRef.current = blobUrl;

        if (onSuccess) {
          onSuccess(blob);
        }
      } catch (err) {
        if (!mounted.current) return;

        const error = err instanceof Error ? err : new Error('Download failed');
        setError(error);

        if (onError) {
          onError(error);
        }
      } finally {
        if (mounted.current) {
          setLoading(false);
        }
      }
    },
    [client, onSuccess, onError]
  );

  const reset = useCallback(() => {
    // Revoke old URL
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }

    setData(null);
    setUrl(null);
    setError(null);
    setLoading(false);
  }, []);

  // Cleanup
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }
    };
  }, []);

  return {
    data,
    url,
    error,
    loading,
    download,
    reset,
  };
}
