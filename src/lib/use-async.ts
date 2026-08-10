import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  /** True during a manual reload, so pull-to-refresh does not blank the screen. */
  isRefreshing: boolean;
  reload: () => Promise<void>;
};

/**
 * Runs an async query and tracks its state.
 *
 * Deliberately small — DriveSafe has a handful of screens and does not need a
 * caching layer yet. The one thing it does carefully is ignore results from a
 * stale run, so switching accounts cannot leave the previous family's data on
 * screen.
 */
export function useAsync<T>(
  run: () => Promise<T>,
  deps: React.DependencyList,
  options: { enabled?: boolean } = {}
): AsyncState<T> {
  const enabled = options.enabled ?? true;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const runRef = useRef(run);
  runRef.current = run;

  const token = useRef(0);

  const execute = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!enabled) {
        setIsLoading(false);
        return;
      }

      const current = ++token.current;
      if (mode === 'refresh') setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const result = await runRef.current();
        if (current !== token.current) return;
        setData(result);
        setError(null);
      } catch (caught) {
        if (current !== token.current) return;
        setError(caught instanceof Error ? caught.message : 'Something went wrong.');
      } finally {
        if (current === token.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [enabled]
  );

  useEffect(() => {
    void execute('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const reload = useCallback(() => execute('refresh'), [execute]);

  return { data, error, isLoading, isRefreshing, reload };
}
