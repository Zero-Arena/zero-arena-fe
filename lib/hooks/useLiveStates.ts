"use client";

import { useEffect, useState } from "react";
import { fetchLiveStates, isStateConfigured, type LiveState } from "@/lib/be/live-state";

interface UseLiveStatesResult {
  states: Map<string, LiveState>;
  lastUpdatedAt: number;
  enabled: boolean;
  error: unknown | null;
}

/**
 * Poll the onboard service's `/state/:tokenId` endpoint for a set of tokens
 * and re-render on each successful refresh.
 *
 * Cadence: default 1500ms — fast enough that the leaderboard feels live
 * (sub-2s lag from a candle close), slow enough to stay well under the
 * 600 req/min/IP rate limit even with many tokens × many viewers.
 *
 * Server-render compatibility: returns an empty Map on first render so the
 * parent component falls back to chain-derived values. After hydration the
 * first poll fires immediately, then the interval takes over.
 *
 * Cleanup: an AbortController cancels the in-flight fetch on unmount or
 * when the token set changes, so leaderboard navigations don't leak
 * connections.
 */
export function useLiveStates(
  tokenIds: readonly bigint[],
  opts?: { intervalMs?: number; disabled?: boolean },
): UseLiveStatesResult {
  const [states, setStates] = useState<Map<string, LiveState>>(() => new Map());
  const [lastUpdatedAt, setLastUpdatedAt] = useState(0);
  const [error, setError] = useState<unknown | null>(null);

  const intervalMs = opts?.intervalMs ?? 1500;
  const enabled = !opts?.disabled && isStateConfigured() && tokenIds.length > 0;

  // Key the effect on the stringified tokenId set so the polling restarts
  // exactly when the leaderboard membership changes (a token enrolls /
  // settles out) — not on every parent re-render.
  const key = tokenIds.map((t) => t.toString()).join(",");

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let cancelled = false;

    const tick = async (): Promise<void> => {
      try {
        const next = await fetchLiveStates(tokenIds, {
          signal: controller.signal,
          onError: () => { /* per-token errors are non-fatal */ },
        });
        if (!cancelled) {
          setStates(next);
          setLastUpdatedAt(Date.now());
          setError(null);
        }
      } catch (err) {
        if (!cancelled && (err as { name?: string }).name !== "AbortError") {
          setError(err);
        }
      }
    };

    void tick();
    const handle = setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(handle);
    };
    // `key` captures the token-set identity; tokenIds itself is a fresh
    // array on every parent render so depending on it directly would
    // restart polling every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, intervalMs, enabled]);

  return { states, lastUpdatedAt, enabled, error };
}
