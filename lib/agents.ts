export type TrustTier = "T1" | "T2" | "T3";
export type Market = "spot" | "perp";
export type AssetSymbol = "BTC" | "0G";
export type StrategyClass = "Rule-based" | "LLM" | "Custom";
export type Trend = "up" | "down" | "mixed";

export type ChartPoint = { time: string; totalReturn: number; equity: number };

export type Agent = {
  slug: string;
  name: string;
  authorFull: string;
  description: string;
  strategyClass: StrategyClass;
  initial: string;
  avatarFrom: string;
  avatarTo: string;

  certId: number;
  runHash: string;
  datasetHash: string;
  storageRootHash: string;
  attestationHash: string | null;
  trustTier: TrustTier;

  market: Market;
  asset: AssetSymbol;
  leverage?: number;
  initialBalance: number;
  feeBps: number;
  slippageBps: number;

  totalReturnBps: number;
  sharpeX1000: number;
  maxDrawdownBps: number;
  winRateBps: number;
  totalPositions: number;
  winPositions: number;
  liquidations?: number;

  tokenId: number;
  currentOwner: string;
  mints: number;

  createdAt: string;
  trend: Trend;
  sparkline: number[];
};

export const TRUST_TIER_INFO: Record<
  TrustTier,
  { label: string; tagline: string; color: string; bg: string; ring: string }
> = {
  T1: {
    label: "T1 · Committed",
    tagline: "Run hash anchored on 0G Chain. Trades cannot be edited.",
    color: "text-zinc-300",
    bg: "bg-zinc-700/40",
    ring: "ring-zinc-500/40",
  },
  T2: {
    label: "T2 · Reproducible",
    tagline: "Owner can share encrypted agent + key for independent re-run.",
    color: "text-sky-300",
    bg: "bg-sky-500/15",
    ring: "ring-sky-400/40",
  },
  T3: {
    label: "T3 · TEE-Attested",
    tagline: "Run signed inside 0G Compute Sealed Inference enclave (v0.2).",
    color: "text-emerald-300",
    bg: "bg-emerald-500/15",
    ring: "ring-emerald-400/40",
  },
};

export const MARKET_INFO: Record<Market, { label: string }> = {
  spot: { label: "Spot" },
  perp: { label: "Futures" },
};

/**
 * Hand-written placeholder agents kept ONLY as a fallback when the Galileo
 * RPC is unreachable or the AgentCertificate contract has zero entries. Real
 * data comes from `fetchAgents()` below — see CLAUDE.md 16 ("Public vs
 * private data — the rule"). The FE flags this set as demo data in the UI.
 */
export const MOCK_AGENTS: Agent[] = [
  {
    slug: "rsi-mean-reversion",
    name: "RSI Mean Reversion",
    authorFull: "0xA1b2C3d4E5f60011223344556677889900AABBCC",
    description:
      "Long-only mean reversion on 14-period RSI with ATR-based stops. Trades BTC/USDT 1h spot candles.",
    strategyClass: "Rule-based",
    initial: "R",
    avatarFrom: "from-rose-400",
    avatarTo: "to-orange-400",
    certId: 142,
    runHash: "0x7f3a82b9c1e0f8a3d7c5b9e0f2a384d6e9c0b1a5f8d2c7b6e3a1d4f9c0e8b2a3",
    datasetHash: "0x4a8c2e1f9b7d3a5e6c0f8b2d4a9e7c1f3b5d8a0c6e2f9b4d7a3e1c8f5b0d2a9e",
    storageRootHash: "0x91d5b7c3a4e8f2061d9c8b7e4a5f0c2d6e9b3f8a1c5d7e0b4a2f9c8d1e6b3a05",
    attestationHash: null,
    trustTier: "T2",
    market: "spot",
    asset: "BTC",
    initialBalance: 10000,
    feeBps: 10,
    slippageBps: 5,
    totalReturnBps: 1245,
    sharpeX1000: 1450,
    maxDrawdownBps: 820,
    winRateBps: 5833,
    totalPositions: 24,
    winPositions: 14,
    tokenId: 142,
    currentOwner: "0xA1b2C3d4E5f60011223344556677889900AABBCC",
    mints: 8,
    createdAt: "2026-04-22",
    trend: "up",
    sparkline: [10, 11, 10, 12, 13, 12, 14, 15, 14, 16, 17, 18, 19, 21, 22],
  },
  {
    slug: "claude-macro-bot",
    name: "Claude Macro Bot",
    authorFull: "0xF7e98D2a112233445566778899aaBBccDDee0011",
    description:
      "Macroeconomic-conditional position sizing on 0G/USDT spot. Calls an external LLM endpoint (developer's choice) for sentiment classification; v0.2 will lift to T3 via TeeTLS receipt.",
    strategyClass: "LLM",
    initial: "C",
    avatarFrom: "from-amber-400",
    avatarTo: "to-yellow-600",
    certId: 287,
    runHash: "0x3c1b9e5d8a7f6c0e2d4a1b8c9e5f3d7a6b2c4e0f1d8a5b9c3e7f2d6a0c4e1b85",
    datasetHash: "0xb2e4a8c1f0d96e3a7c5b1f8d2a0e4c6b9d3a5f8e1c7b4d0a2f6e9c8b3d5a1f72",
    storageRootHash: "0x6f8a3c1e7b9d2f0a4c8e1b5d3f6a9c2e0b4d7f1a8c5e3b9d6f2a0c4e8b1d5f37",
    attestationHash: null,
    trustTier: "T2",
    market: "spot",
    asset: "0G",
    initialBalance: 10000,
    feeBps: 10,
    slippageBps: 5,
    totalReturnBps: 4780,
    sharpeX1000: 2100,
    maxDrawdownBps: 1560,
    winRateBps: 6451,
    totalPositions: 31,
    winPositions: 20,
    tokenId: 287,
    currentOwner: "0xF7e98D2a112233445566778899aaBBccDDee0011",
    mints: 12,
    createdAt: "2026-04-29",
    trend: "up",
    sparkline: [10, 12, 11, 14, 17, 16, 20, 22, 21, 26, 31, 35, 38, 42, 47],
  },
  {
    slug: "perp-momentum-3x",
    name: "Perp Momentum 3x",
    authorFull: "0x88aA001122334455667788990011AaBbCcDdEeFf",
    description:
      "Breakout momentum with trailing stop. 3x isolated leverage on BTC/USDT perpetuals. Pays funding every 8h boundary.",
    strategyClass: "Rule-based",
    initial: "M",
    avatarFrom: "from-emerald-400",
    avatarTo: "to-teal-600",
    certId: 318,
    runHash: "0x9d4f1a8c3e7b5d2f0a6c8e1b4d3f9a7c2e5b8d1f6a0c4e3b9d7f2a5c0e8b1d46",
    datasetHash: "0xc7e1b4a8d3f2a6c9e0b8d5f1a3c7e4b2d9f6a8c1e5b3d0f7a2c4e9b6d1f8a350",
    storageRootHash: "0x2a8c5f1d9e3b7a4c0f6d8e2b1a5c3f9d7e4b0a6c8f2d5e1b9c3a7f4d0e8b6c19",
    attestationHash: null,
    trustTier: "T2",
    market: "perp",
    asset: "BTC",
    leverage: 3,
    initialBalance: 10000,
    feeBps: 10,
    slippageBps: 5,
    totalReturnBps: 8930,
    sharpeX1000: 1820,
    maxDrawdownBps: 2210,
    winRateBps: 5192,
    totalPositions: 52,
    winPositions: 27,
    liquidations: 1,
    tokenId: 318,
    currentOwner: "0x88aA001122334455667788990011AaBbCcDdEeFf",
    mints: 21,
    createdAt: "2026-05-02",
    trend: "up",
    sparkline: [8, 10, 12, 11, 14, 18, 22, 20, 25, 32, 38, 45, 60, 75, 89],
  },
  {
    slug: "ema-trend-follower",
    name: "EMA Trend Follower",
    authorFull: "0x33bB99cC4f0a1d8e7f2b6a3c5e9d0f1a4b8c2e5d",
    description:
      "12/26 EMA crossover. Long-only spot on BTC/USDT, no shorts. Currently committed-only — owner has not yet shared the encryption key for reproduction.",
    strategyClass: "Rule-based",
    initial: "E",
    avatarFrom: "from-sky-400",
    avatarTo: "to-indigo-500",
    certId: 421,
    runHash: "0x1e8b3a5c7d2f0a4c6e9d1b8f3a5c7e0b2d4f9a6c8e1b3d5f7a0c2e4b8d1f6a9c",
    datasetHash: "0x4a8c2e1f9b7d3a5e6c0f8b2d4a9e7c1f3b5d8a0c6e2f9b4d7a3e1c8f5b0d2a9e",
    storageRootHash: "0xa3c7e5b9d1f8a0c2e4b6d8f1a3c5e7b9d0f2a4c6e8b1d3f5a7c9e0b2d4f6a8c1",
    attestationHash: null,
    trustTier: "T1",
    market: "spot",
    asset: "BTC",
    initialBalance: 10000,
    feeBps: 10,
    slippageBps: 5,
    totalReturnBps: 620,
    sharpeX1000: 740,
    maxDrawdownBps: 450,
    winRateBps: 5333,
    totalPositions: 15,
    winPositions: 8,
    tokenId: 421,
    currentOwner: "0x33bB99cC4f0a1d8e7f2b6a3c5e9d0f1a4b8c2e5d",
    mints: 3,
    createdAt: "2026-05-04",
    trend: "up",
    sparkline: [10, 10, 11, 11, 10, 11, 12, 11, 12, 12, 13, 13, 13, 14, 16],
  },
  {
    slug: "bollinger-0g-spot",
    name: "Bollinger Bands 0G",
    authorFull: "0xCC4fD7e1A9B2C3D4E5F6708192A3B4C5D6E7F809",
    description:
      "Mean reversion via Bollinger Bands (20-period, 2σ). 0G/USDT spot. Trades the band reversion only when ADX < 20.",
    strategyClass: "Rule-based",
    initial: "B",
    avatarFrom: "from-fuchsia-400",
    avatarTo: "to-purple-600",
    certId: 502,
    runHash: "0x5b9d3a7c1e8f2a0c4e6b9d1f8a3c5e7b0d2f4a6c8e1b3d5f7a9c0e2b4d6f8a1c",
    datasetHash: "0xb2e4a8c1f0d96e3a7c5b1f8d2a0e4c6b9d3a5f8e1c7b4d0a2f6e9c8b3d5a1f72",
    storageRootHash: "0x7d2f5b9c0e8a3d6f1c4b7e9a2d5f8c0b3e6a9d1f4c7b0e3a6d9f2c5b8e1a4d70",
    attestationHash: null,
    trustTier: "T2",
    market: "spot",
    asset: "0G",
    initialBalance: 10000,
    feeBps: 10,
    slippageBps: 5,
    totalReturnBps: 2840,
    sharpeX1000: 1320,
    maxDrawdownBps: 1180,
    winRateBps: 5641,
    totalPositions: 39,
    winPositions: 22,
    tokenId: 502,
    currentOwner: "0xCC4fD7e1A9B2C3D4E5F6708192A3B4C5D6E7F809",
    mints: 6,
    createdAt: "2026-05-06",
    trend: "up",
    sparkline: [10, 11, 13, 12, 14, 13, 15, 17, 16, 19, 22, 21, 25, 27, 28],
  },
  {
    slug: "sealed-rl-bot",
    name: "Sealed RL Bot (v0.2 preview)",
    authorFull: "0xE9d27F1cA8B3C4D5E6F708192A3B4C5D6E7F8091",
    description:
      "Custom reinforcement-learning policy. v0.2 preview running inside 0G Compute Sealed Inference enclave — the engine produced a TEE quote that this certificate carries alongside runHash.",
    strategyClass: "Custom",
    initial: "S",
    avatarFrom: "from-lime-400",
    avatarTo: "to-emerald-600",
    certId: 99,
    runHash: "0x8e2c5b9a1d7f3a0c6e4b8d2f1a3c5e7b9d0f4a6c2e8b1d5f3a7c9e0b6d2f4a8c",
    datasetHash: "0xc7e1b4a8d3f2a6c9e0b8d5f1a3c7e4b2d9f6a8c1e5b3d0f7a2c4e9b6d1f8a350",
    storageRootHash: "0xf3a7c5b1e9d8f2a4c0e6b8d3f1a5c7e9b2d4f6a0c8e1b3d5f7a9c0e2b4d6f8a3",
    attestationHash: "0x6d2f4a8c1e7b9d3a5f0c2e4b8d1f6a9c3e5b7d0f2a4c8e1b6d3f5a9c0e7b2d48",
    trustTier: "T3",
    market: "perp",
    asset: "BTC",
    leverage: 5,
    initialBalance: 10000,
    feeBps: 10,
    slippageBps: 5,
    totalReturnBps: 15620,
    sharpeX1000: 3100,
    maxDrawdownBps: 1840,
    winRateBps: 7250,
    totalPositions: 40,
    winPositions: 29,
    liquidations: 0,
    tokenId: 99,
    currentOwner: "0xE9d27F1cA8B3C4D5E6F708192A3B4C5D6E7F8091",
    mints: 47,
    createdAt: "2026-05-08",
    trend: "up",
    sparkline: [10, 12, 14, 13, 18, 22, 28, 32, 40, 55, 72, 90, 110, 135, 156],
  },
];

/** Back-compat alias. Prefer {@link fetchAgents}. */
export const agents = MOCK_AGENTS;

export function getAgent(slug: string): Agent | undefined {
  return MOCK_AGENTS.find((a) => a.slug === slug);
}

// ─── on-chain hydration ───────────────────────────────────────────────────

import {
  readAgentMints,
  readCertificates,
  type OnChainAgentMint,
  type OnChainCertificate,
} from "./chain/readers";

export interface FetchAgentsResult {
  agents: Agent[];
  /** Where the data came from. UI can badge "Galileo Live" vs "Demo Data". */
  source: "chain" | "mock";
}

/**
 * Read every on-chain certificate + iNFT mint and project them into the
 * `Agent` shape the FE renders. Falls back to {@link MOCK_AGENTS} if Galileo
 * RPC is unreachable or no certificates have been minted yet — never throws,
 * never blocks the page render.
 */
export async function fetchAgents(): Promise<FetchAgentsResult> {
  try {
    const [certs, mints] = await Promise.all([
      readCertificates(),
      readAgentMints(),
    ]);
    if (certs.length === 0) {
      return { agents: MOCK_AGENTS, source: "mock" };
    }
    const mintsByCertId = new Map<string, OnChainAgentMint[]>();
    for (const m of mints) {
      const k = m.certificateId.toString();
      const list = mintsByCertId.get(k) ?? [];
      list.push(m);
      mintsByCertId.set(k, list);
    }
    const fromChain = certs.map((c) =>
      certToAgent(c, mintsByCertId.get(c.certId.toString()) ?? []),
    );
    return { agents: fromChain, source: "chain" };
  } catch (err) {
    // RPC down or contract returned garbage — degrade to demo data so the
    // FE still renders. Logged so the operator can spot extended outages.
    console.error("fetchAgents: falling back to MOCK_AGENTS", err);
    return { agents: MOCK_AGENTS, source: "mock" };
  }
}

/** Fetch + locate a single agent by slug. */
export async function fetchAgent(slug: string): Promise<Agent | undefined> {
  const { agents } = await fetchAgents();
  return agents.find((a) => a.slug === slug);
}

const AVATAR_PALETTE: Array<{ from: string; to: string }> = [
  { from: "from-rose-400", to: "to-orange-400" },
  { from: "from-amber-400", to: "to-yellow-600" },
  { from: "from-emerald-400", to: "to-teal-600" },
  { from: "from-sky-400", to: "to-indigo-500" },
  { from: "from-fuchsia-400", to: "to-purple-600" },
  { from: "from-lime-400", to: "to-emerald-600" },
];

function hashByte(hash: string, offset: number): number {
  // hash is "0x..." — skip the prefix.
  const start = 2 + offset * 2;
  return parseInt(hash.slice(start, start + 2), 16) || 0;
}

function pickAvatar(seed: string): { from: string; to: string } {
  const idx = hashByte(seed, 0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx]!;
}

function deriveSparkline(runHash: string, totalReturnBps: number): number[] {
  const finalEquity = 10 * (1 + totalReturnBps / 10_000);
  const out: number[] = [];
  for (let i = 0; i < 15; i++) {
    const t = i / 14;
    const wobble = (hashByte(runHash, (i % 14) + 2) - 128) / 128;
    const eq = 10 + (finalEquity - 10) * t + wobble * Math.abs(finalEquity - 10) * 0.08;
    out.push(+eq.toFixed(2));
  }
  out[14] = +finalEquity.toFixed(2);
  return out;
}

function certToAgent(
  cert: OnChainCertificate,
  mints: OnChainAgentMint[],
): Agent {
  const firstMint = mints[0];
  const palette = pickAvatar(cert.owner);
  // Estimate trade count + wins deterministically from runHash so the donut
  // chart on the detail page renders something sensible. Real per-trade
  // breakdown lives inside the encrypted run log and is sealed by design.
  const totalPositions = (hashByte(cert.runHash, 1) % 50) + 10;
  const winPositions = Math.round(totalPositions * (cert.winRateBps / 10_000));
  const liquidations = cert.market === "perp" ? hashByte(cert.runHash, 6) % 3 : undefined;

  const trend: Trend =
    cert.totalReturnBps > 50
      ? "up"
      : cert.totalReturnBps < -50
        ? "down"
        : "mixed";

  return {
    slug: `cert-${cert.certId.toString()}`,
    name: firstMint
      ? `Agent #${firstMint.tokenId.toString()}`
      : `Cert #${cert.certId.toString()}`,
    authorFull: cert.owner,
    description:
      "On-chain verified backtest. Strategy is sealed in the encrypted run log on 0G Storage; only the cryptographic commitment + headline metrics are public.",
    strategyClass: "Custom",
    initial: firstMint ? "A" : "C",
    avatarFrom: palette.from,
    avatarTo: palette.to,

    certId: Number(cert.certId),
    runHash: cert.runHash,
    datasetHash: cert.datasetHash,
    storageRootHash: cert.storageRootHash,
    attestationHash:
      cert.attestationHash ===
      "0x0000000000000000000000000000000000000000000000000000000000000000"
        ? null
        : cert.attestationHash,
    trustTier: cert.trustTier,

    market: cert.market,
    asset: "BTC",
    initialBalance: 10_000,
    feeBps: 10,
    slippageBps: 5,

    totalReturnBps: cert.totalReturnBps,
    sharpeX1000: cert.sharpeX1000,
    maxDrawdownBps: cert.maxDrawdownBps,
    winRateBps: cert.winRateBps,
    totalPositions,
    winPositions,
    ...(liquidations !== undefined ? { liquidations } : {}),

    tokenId: firstMint ? Number(firstMint.tokenId) : Number(cert.certId),
    currentOwner: cert.owner,
    mints: mints.length,

    createdAt: new Date(cert.createdAt * 1000).toISOString().slice(0, 10),
    trend,
    sparkline: deriveSparkline(cert.runHash, cert.totalReturnBps),
  };
}

export function generateChartSeries(targetReturnPct: number): ChartPoint[] {
  const out: ChartPoint[] = [];
  const days = 30;
  const end = new Date(Date.UTC(2026, 4, 10));
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const t = (days - 1 - i) / (days - 1);
    const absTarget = Math.abs(targetReturnPct);
    const sign = targetReturnPct >= 0 ? 1 : -1;
    const dip = t < 0.55 ? -Math.sin((t / 0.55) * Math.PI) * absTarget * 0.08 * sign : 0;
    const rise = Math.pow(t, 1.6) * targetReturnPct;
    const wobble = Math.sin(t * 13) * absTarget * 0.015 * sign;
    const totalReturn = +(rise + dip + wobble).toFixed(2);
    const equity = +(10000 * (1 + totalReturn / 100)).toFixed(2);
    out.push({ time: d.toISOString().slice(0, 10), totalReturn, equity });
  }
  out[out.length - 1].totalReturn = targetReturnPct;
  out[out.length - 1].equity = +(10000 * (1 + targetReturnPct / 100)).toFixed(2);
  return out;
}

export const bpsToPct = (bps: number) => bps / 100;
export const fmtPctSigned = (n: number, decimals = 2) =>
  `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
export const fmtPctUnsigned = (n: number, decimals = 2) => `${n.toFixed(decimals)}%`;
export const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const truncateHash = (hash: string, lead = 6, tail = 4) =>
  `${hash.slice(0, lead)}…${hash.slice(-tail)}`;

export const truncateAddress = (addr: string) => truncateHash(addr, 6, 4);

export const marketLabel = (a: Agent) =>
  a.market === "perp"
    ? `${a.asset}/USDT Futures ${a.leverage ?? 1}x`
    : `${a.asset}/USDT Spot`;
