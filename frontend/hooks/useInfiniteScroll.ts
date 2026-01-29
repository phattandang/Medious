import { useState, useCallback, useRef, useEffect } from 'react';

interface FetchResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface UseInfiniteScrollOptions<T> {
  fetchFn: (cursor?: string) => Promise<FetchResult<T>>;
  enabled?: boolean;
}

interface UseInfiniteScrollReturn<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
}

export function useInfiniteScroll<T>(
  options: UseInfiniteScrollOptions<T>
): UseInfiniteScrollReturn<T> {
  const { fetchFn, enabled = true } = options;

  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use ref to store fetchFn to avoid infinite loops
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  // Prevent duplicate calls
  const isLoadingRef = useRef(false);

  const loadInitial = useCallback(async () => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFnRef.current();
      setItems(result.items);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
      console.error('Load initial error:', err);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || loadingMore) {
      return;
    }

    // Get current cursor value
    setCursor((currentCursor) => {
      if (!currentCursor) return currentCursor;

      isLoadingRef.current = true;
      setLoadingMore(true);
      setError(null);

      fetchFnRef.current(currentCursor)
        .then((result) => {
          setItems((prev) => [...prev, ...result.items]);
          setCursor(result.nextCursor);
          setHasMore(result.hasMore);
        })
        .catch((err: any) => {
          setError(err.message || 'Failed to load more');
          console.error('Load more error:', err);
        })
        .finally(() => {
          setLoadingMore(false);
          isLoadingRef.current = false;
        });

      return currentCursor;
    });
  }, [loadingMore]);

  const refresh = useCallback(async () => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    setRefreshing(true);
    setError(null);

    try {
      const result = await fetchFnRef.current();
      setItems(result.items);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh');
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
      isLoadingRef.current = false;
    }
  }, []);

  // Load initial data on mount (only once when enabled)
  useEffect(() => {
    if (enabled) {
      loadInitial();
    } else {
      // Not enabled (no token), don't show loading spinner
      setLoading(false);
    }
  }, [enabled, loadInitial]);

  return {
    items,
    loading,
    loadingMore,
    refreshing,
    hasMore,
    error,
    loadMore,
    refresh,
    setItems,
  };
}

export default useInfiniteScroll;
