// Static snapshot of the canonical 0G datasets, mirrored from
// zero-arena-sdk/src/datasets.ts. Kept here so the FE doesn't need an npm
// dep on `zeroarena` (per CLAUDE.md 16 — FE should not pull SDK into the
// browser bundle). When zeroarena ships on npm we can swap this for the
// direct import.
//
// Bump this file in lockstep with the SDK's datasets.ts whenever the
// workspace operator re-uploads via `bacend dataset upload`.

export interface CanonicalDataset {
  rootHash: `0x${string}`;
  datasetHash: `0x${string}`;
  symbol: string;
  interval: string;
  market: "spot" | "perp";
  source: string;
  startTs: number;
  endTs: number;
  candleCount: number;
  uploadedAt: string;
}

export const CANONICAL_DATASETS: Record<string, CanonicalDataset> = {
  "BTCUSDT-15m-spot": {
    rootHash:
      "0xbdf356979b9dac6e742feb0362df54a158c0c358113d15233fa00e74fc5b3ad1",
    datasetHash:
      "0xef045d37191201052a600853e2a1f4bdcd0f6abed368b71d237e17b573972361",
    symbol: "BTCUSDT",
    interval: "15m",
    market: "spot",
    source: "binance",
    startTs: 1775952000000,
    endTs: 1778553000000,
    candleCount: 2891,
    uploadedAt: "2026-05-12T02:35:51.166Z",
  },
};

/** Look up a dataset entry by its keccak256 hash. Returns undefined if unknown. */
export function findDataset(datasetHash: string): CanonicalDataset | undefined {
  const lower = datasetHash.toLowerCase();
  for (const entry of Object.values(CANONICAL_DATASETS)) {
    if (entry.datasetHash.toLowerCase() === lower) return entry;
  }
  return undefined;
}

/** Human-readable window (e.g. "Apr 24 → May 12, 2026"). */
export function formatWindow(d: CanonicalDataset): string {
  const fmt = (ts: number) =>
    new Date(ts).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(d.startTs)} → ${fmt(d.endTs)}`;
}
