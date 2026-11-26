"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Shared AbortController lifecycle helper ensuring stale requests cancel cleanly on unmount or re-fetch.
 */
export function useAsyncResource() {
  const abortRef = useRef<AbortController | null>(null);

  const nextSignal = useCallback((): AbortSignal => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller.signal;
  }, []);

  const abortPending = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => abortPending, [abortPending]);

  return { nextSignal, abortPending };
}
