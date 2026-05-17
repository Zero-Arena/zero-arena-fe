// Typed client for the v0.5 onboard service's `/state/:tokenId` endpoint.
//
// This is the off-chain real-time channel: while LiveCertificate epochs land
// on chain at the `barsPerEpoch` cadence (default daily, demo 1/min), the
// daemon also writes a snapshot to disk on every candle close (~1s with
// sub-minute intervals). The FE polls /state for live leaderboard cells
// (Live Return / Sharpe / Win Rate / Max DD) so users see equity move with
// the market instead of jumping at each epoch commit.
//
// Pairing: server-side renders chain-derived values for SSR + verifiability;
// client-side hook upgrades to /state when available. If the endpoint is
// unreachable or the daemon has never run for a token, the chain values
// remain the displayed source — no broken-empty cells.

const STATE_PATH = "/state";

export interface LiveMetrics {
  totalReturnBps: number;
  sharpeX1000: number;
  maxDrawdownBps: number;
  winRateBps: number;
  profitFactorX1000: number;
  numClosedTrades: number;
  totalTradeEvents: number;
  equity: number;
  lastPrice: number;
}

export interface LiveState {
  tokenId: string;
  active: boolean;
  lastCandleTs: number;
  lastCandleTsIso: string;
  barIndex: number;
  epochIndex: number;
  cumulativeHash: `0x${string}`;
  startedAt: number;
  liveMetrics: LiveMetrics | null;
}

function baseUrl(): string | null {
  return process.env.NEXT_PUBLIC_ONBOARD_URL?.trim() || null;
}

export function isStateConfigured(): boolean {
  return baseUrl() !== null;
}

export class LiveStateError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "LiveStateError";
  }
}

/**
 * Fetch one token's live state. Returns null on 404 (the daemon never ran
 * for this tokenId — common during initial enrollment or for tokens that
 * only ever traded via the static-cert path). Throws on transport / 5xx
 * so the caller can decide to retry.
 */
export async function fetchLiveState(
  tokenId: bigint,
  signal?: AbortSignal,
): Promise<LiveState | null> {
  const base = baseUrl();
  if (!base) return null;
  const url = `${base}${STATE_PATH}/${tokenId.toString()}`;
  const res = await fetch(url, { signal, cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LiveStateError(`state ${res.status} ${text.slice(0, 200)}`, res.status);
  }
  return (await res.json()) as LiveState;
}

/**
 * Fetch live state for multiple tokens in parallel. Returns a Map keyed by
 * the stringified tokenId so callers (typically a leaderboard render) can
 * `.get(token.toString())` without ordering guarantees.
 *
 * Individual fetch failures are swallowed — one bad token shouldn't blank
 * the whole leaderboard. Errors are surfaced via the optional onError
 * callback so the caller can show a banner if everything fails.
 */
export async function fetchLiveStates(
  tokenIds: readonly bigint[],
  opts?: { signal?: AbortSignal; onError?: (tokenId: bigint, err: unknown) => void },
): Promise<Map<string, LiveState>> {
  const out = new Map<string, LiveState>();
  const settled = await Promise.allSettled(
    tokenIds.map(async (t) => {
      try {
        const s = await fetchLiveState(t, opts?.signal);
        if (s) out.set(t.toString(), s);
      } catch (err) {
        opts?.onError?.(t, err);
      }
    }),
  );
  // Defensive: a rejected promise inside Promise.allSettled bubbled errors
  // are already routed through onError above; we don't need the result here.
  void settled;
  return out;
}

// ─── helper getters for the FE leaderboard ───────────────────────────────

/**
 * Pick the metric value the FE should show: live (off-chain) if available
 * AND the daemon is active, otherwise the chain-derived fallback. Active +
 * recent-snapshot is the trigger to overlay — a stale snapshot with the
 * daemon offboarded should not override the chain value (it's just
 * yesterday's last-known state and would mislead the viewer).
 */
export function pickReturnBps(
  live: LiveState | null | undefined,
  chainFallback: number,
): { value: number; source: "live" | "chain" } {
  if (live?.active && live.liveMetrics) {
    return { value: live.liveMetrics.totalReturnBps, source: "live" };
  }
  return { value: chainFallback, source: "chain" };
}

export function pickSharpeX1000(
  live: LiveState | null | undefined,
  chainFallback: number,
): { value: number; source: "live" | "chain" } {
  if (live?.active && live.liveMetrics) {
    return { value: live.liveMetrics.sharpeX1000, source: "live" };
  }
  return { value: chainFallback, source: "chain" };
}

export function pickMaxDrawdownBps(
  live: LiveState | null | undefined,
  chainFallback: number,
): { value: number; source: "live" | "chain" } {
  if (live?.active && live.liveMetrics) {
    return { value: live.liveMetrics.maxDrawdownBps, source: "live" };
  }
  return { value: chainFallback, source: "chain" };
}

export function pickWinRateBps(
  live: LiveState | null | undefined,
  chainFallback: number,
): { value: number; source: "live" | "chain" } {
  if (live?.active && live.liveMetrics) {
    return { value: live.liveMetrics.winRateBps, source: "live" };
  }
  return { value: chainFallback, source: "chain" };
}
