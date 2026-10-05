import { useEffect, useState, type DependencyList } from 'react';

interface State<T> {
  data?: T;
  error?: Error;
  loading: boolean;
}

/** Runs an async factory whenever deps change; ignores stale results. */
export function useAsync<T>(factory: () => Promise<T> | undefined, deps: DependencyList): State<T> {
  const [state, setState] = useState<State<T>>({ loading: true });
  useEffect(() => {
    let live = true;
    const p = factory();
    if (!p) { setState({ loading: false }); return; }
    setState((s) => ({ ...s, loading: true, error: undefined }));
    p.then(
      (data) => { if (live) setState({ data, loading: false }); },
      (error: Error) => { if (live) setState({ error, loading: false }); },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
