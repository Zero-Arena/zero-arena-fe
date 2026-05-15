// Optional human-readable display overlay for on-chain certs/iNFTs.
//
// Per CLAUDE.md §16 the strategy name + description live inside the
// encrypted metadata blob — the FE can't decrypt that. For demo / hackathon
// presentation, the workspace operator can publish a small lookup table
// here that maps tokenId → display name. The chain remains the source of
// truth for metrics, ownership, runHash, etc.; this overlay only adorns
// what would otherwise render as "Agent #<tokenId>".
//
// Production answer is the public profile registry or a publicMeta field
// on mint (RFC pending) — both leave the encrypted blob untouched.

export interface RosterOverlay {
  name: string;
  description: string;
  strategyClass: 'Rule-based' | 'LLM' | 'Custom';
  slug: string;
}

export const ROSTER_OVERLAY: Record<string, RosterOverlay> = {
  '1': {
    slug: 'rsi-classic',
    name: 'RSI Classic 30/70',
    description: 'RSI(14) mean reversion · oversold 30 / overbought 70 · 50% size.',
    strategyClass: 'Rule-based',
  },
  '2': {
    slug: 'rsi-classic-alt-a',
    name: 'RSI Classic 30/70 · alt mint',
    description: 'Same strategy, re-minted from a separate certificate (same runHash).',
    strategyClass: 'Rule-based',
  },
  '3': {
    slug: 'rsi-classic-alt-b',
    name: 'RSI Classic 30/70 · alt mint',
    description: 'Same strategy, re-minted from a separate certificate (same runHash).',
    strategyClass: 'Rule-based',
  },
  '4': {
    slug: 'rsi-aggressive',
    name: 'RSI Aggressive 25/75',
    description: 'Wider RSI bands · 25/75 · 70% size · fewer trades, larger conviction.',
    strategyClass: 'Rule-based',
  },
  '5': {
    slug: 'ema-crossover',
    name: 'EMA Crossover 12/26',
    description: 'Classic trend-follower · long when fast EMA > slow EMA.',
    strategyClass: 'Rule-based',
  },
  '6': {
    slug: 'macd-spot',
    name: 'MACD Spot Bull',
    description: 'Long-only MACD crossover · long while MACD > signal AND > 0.',
    strategyClass: 'Rule-based',
  },
  '7': {
    slug: 'bollinger-meanrev',
    name: 'Bollinger Mean Reversion',
    description: 'Buy lower band, flat at upper band · 20-bar window, 2σ.',
    strategyClass: 'Rule-based',
  },
};

/** Look up a display overlay by tokenId. Returns null if unmapped. */
export function lookupRoster(tokenId: bigint | string | number): RosterOverlay | null {
  return ROSTER_OVERLAY[tokenId.toString()] ?? null;
}
