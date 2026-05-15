// Readers for the v0.3 paper-trading contracts (RFC-001). Every reader
// short-circuits when the relevant address is the zero-placeholder. In that
// short-circuit it returns demo data so the FE can render a populated
// dashboard for hackathon judges; the UI flags this set as "Demo data"
// per CLAUDE.md 16. Once
//   NEXT_PUBLIC_LIVE_CERTIFICATE_ADDRESS
//   NEXT_PUBLIC_SEASON_ADDRESS
// are set, the mock branches go cold and chain data takes over with zero
// code changes.

import { publicClient } from "./client";
import {
  CONTRACTS,
  LIVE_CERTIFICATE_ABI,
  SEASON_ABI,
  isDeployed,
  marketFromByte,
  statusFromByte,
} from "./contracts";
import { MOCK_AGENTS } from "../agents";
import { lookupRoster } from "./roster-overlay";

export interface LiveRun {
  tokenId: bigint;
  cumulativeHash: `0x${string}`;
  startedAt: number;
  lastUpdatedAt: number;
  epochCount: number;
  status: "active" | "stopped" | "liquidated";
  liveMaxDrawdownBps: number;
  liveWinRateBps: number;
  liveTotalReturnBps: number;
  liveSharpeX1000: number;
}

export interface SeasonSummary {
  id: bigint;
  datasetSpec: `0x${string}`;
  initialBalance: bigint;
  feeBps: number;
  slippageBps: number;
  market: "spot" | "perp";
  maxLeverage: number;
  startTime: number;
  endTime: number;
  prizePool: bigint;
  creator: `0x${string}`;
  settled: boolean;
  participantCount: number;
}

/** Read a single paper run by tokenId. Returns null if no run started. */
export async function readLiveRun(tokenId: bigint): Promise<LiveRun | null> {
  if (!isDeployed(CONTRACTS.LiveCertificate)) return mockLiveRunFor(tokenId);
  try {
    const r = await publicClient.readContract({
      address: CONTRACTS.LiveCertificate,
      abi: LIVE_CERTIFICATE_ABI,
      functionName: "get",
      args: [tokenId],
    });
    return {
      tokenId,
      cumulativeHash: r.cumulativeHash,
      startedAt: Number(r.startedAt),
      lastUpdatedAt: Number(r.lastUpdatedAt),
      epochCount: Number(r.epochCount),
      status: statusFromByte(r.status),
      liveMaxDrawdownBps: Number(r.liveMaxDrawdownBps),
      liveWinRateBps: Number(r.liveWinRateBps),
      liveTotalReturnBps: Number(r.liveTotalReturnBps),
      liveSharpeX1000: Number(r.liveSharpeX1000),
    };
  } catch {
    // get() reverts with NotStarted — treat as "no run".
    return null;
  }
}

/** Read every season ever created. Returns empty array until Season deploys. */
export async function readSeasons(): Promise<SeasonSummary[]> {
  if (!isDeployed(CONTRACTS.Season)) return MOCK_SEASONS;

  const next = await publicClient.readContract({
    address: CONTRACTS.Season,
    abi: SEASON_ABI,
    functionName: "nextSeasonId",
  });

  if (next <= 1n) return [];

  const out: SeasonSummary[] = [];
  for (let id = 1n; id < next; id++) {
    const s = await readSeason(id);
    if (s) out.push(s);
  }
  return out;
}

/** Read one season's spec + participant count. */
export async function readSeason(id: bigint): Promise<SeasonSummary | null> {
  if (!isDeployed(CONTRACTS.Season)) return mockSeasonById(id);
  try {
    const [
      datasetSpec,
      initialBalance,
      feeBps,
      slippageBps,
      market,
      maxLeverage,
      startTime,
      endTime,
      prizePool,
      creator,
      settled,
    ] = await publicClient.readContract({
      address: CONTRACTS.Season,
      abi: SEASON_ABI,
      functionName: "seasons",
      args: [id],
    });
    if (startTime === 0n) return null;
    const participants = await publicClient.readContract({
      address: CONTRACTS.Season,
      abi: SEASON_ABI,
      functionName: "participantCount",
      args: [id],
    });
    return {
      id,
      datasetSpec,
      initialBalance,
      feeBps,
      slippageBps,
      market: marketFromByte(market),
      maxLeverage,
      startTime: Number(startTime),
      endTime: Number(endTime),
      prizePool,
      creator,
      settled,
      participantCount: Number(participants),
    };
  } catch {
    return null;
  }
}

/** Read the full enrolled-tokens list for a season. */
export async function readSeasonParticipants(id: bigint): Promise<bigint[]> {
  if (!isDeployed(CONTRACTS.Season)) return mockSeasonParticipants(id);
  try {
    const tokens = await publicClient.readContract({
      address: CONTRACTS.Season,
      abi: SEASON_ABI,
      functionName: "getParticipants",
      args: [id],
    });
    return [...tokens];
  } catch {
    return [];
  }
}

/** Combined helper: season summary + enriched leaderboard entries. */
export interface SeasonLeaderboardEntry {
  tokenId: bigint;
  /** Slug used by `/agent/[slug]/live`. For chain entries this is `cert-<id>`. */
  slug: string;
  /** Display name; falls back to "Agent #<tokenId>". */
  name: string;
  run: LiveRun | null;
}

export async function readSeasonLeaderboard(seasonId: bigint): Promise<SeasonLeaderboardEntry[]> {
  const participants = await readSeasonParticipants(seasonId);
  if (participants.length === 0) return [];
  const runs = await Promise.all(participants.map((t) => readLiveRun(t)));
  const entries: SeasonLeaderboardEntry[] = participants.map((tokenId, i) => {
    const overlay = lookupRoster(tokenId);
    const mock = MOCK_AGENTS.find((a) => BigInt(a.tokenId) === tokenId);
    return {
      tokenId,
      slug: overlay?.slug ?? mock?.slug ?? `cert-${tokenId.toString()}`,
      name: overlay?.name ?? mock?.name ?? `Agent #${tokenId.toString()}`,
      run: runs[i] ?? null,
    };
  });
  entries.sort((a, b) => {
    const ra = a.run?.liveTotalReturnBps ?? Number.NEGATIVE_INFINITY;
    const rb = b.run?.liveTotalReturnBps ?? Number.NEGATIVE_INFINITY;
    return rb - ra;
  });
  return entries;
}

// ─── demo data ─────────────────────────────────────────────────────────
// Render-time fallback when the v0.3 Season + LiveCertificate contracts
// are not yet deployed to Galileo. Keeps the dashboard demonstrable for
// hackathon judges; flagged as "Demo data" in the UI per CLAUDE.md 16.
// Goes cold automatically once the real addresses are set.

const now = Math.floor(Date.now() / 1000);
const DAY = 86_400;

const SEASON_1_START = now - 12 * DAY;
const SEASON_1_END   = now + 18 * DAY;
const SEASON_2_START = now + 5 * DAY;
const SEASON_2_END   = now + 35 * DAY;
const SEASON_3_START = now - 37 * DAY;
const SEASON_3_END   = now - 7 * DAY;

const ETHER = 10n ** 18n;

const MOCK_SEASONS: SeasonSummary[] = [
  {
    id: 1n,
    datasetSpec: "0x" + "10b6e423".padEnd(64, "0") as `0x${string}`,
    initialBalance: 10_000n,
    feeBps: 10,
    slippageBps: 5,
    market: "spot",
    maxLeverage: 1,
    startTime: SEASON_1_START,
    endTime: SEASON_1_END,
    prizePool: 5n * ETHER,
    creator: "0xB1a5402E46d5360D46A9fE0807D3C927b3f50DbD" as `0x${string}`,
    settled: false,
    participantCount: 6,
  },
  {
    id: 2n,
    datasetSpec: "0x" + "c7e1b4a8".padEnd(64, "0") as `0x${string}`,
    initialBalance: 10_000n,
    feeBps: 10,
    slippageBps: 5,
    market: "perp",
    maxLeverage: 5,
    startTime: SEASON_2_START,
    endTime: SEASON_2_END,
    prizePool: 10n * ETHER,
    creator: "0xB1a5402E46d5360D46A9fE0807D3C927b3f50DbD" as `0x${string}`,
    settled: false,
    participantCount: 3,
  },
  {
    id: 3n,
    datasetSpec: "0x" + "10b6e423".padEnd(64, "0") as `0x${string}`,
    initialBalance: 10_000n,
    feeBps: 10,
    slippageBps: 5,
    market: "spot",
    maxLeverage: 1,
    startTime: SEASON_3_START,
    endTime: SEASON_3_END,
    prizePool: 3n * ETHER,
    creator: "0xB1a5402E46d5360D46A9fE0807D3C927b3f50DbD" as `0x${string}`,
    settled: true,
    participantCount: 5,
  },
];

const MOCK_PARTICIPANTS: Record<string, bigint[]> = {
  "1": [142n, 287n, 318n, 421n, 502n, 99n],
  "2": [318n, 99n, 287n],
  "3": [142n, 287n, 421n, 502n, 318n],
};

/** Deterministic LiveRun fixture per tokenId. Derived from MOCK_AGENTS so
 *  the leaderboard reads consistent with /agents and /leaderboard. */
function mockLiveRun(tokenId: bigint, status: "active" | "stopped" | "liquidated" = "active"): LiveRun {
  const seed = Number(tokenId);
  const agent = MOCK_AGENTS.find((a) => BigInt(a.tokenId) === tokenId);
  return {
    tokenId,
    cumulativeHash: ("0x" + seed.toString(16).padStart(8, "0").repeat(8)) as `0x${string}`,
    startedAt: SEASON_1_START,
    lastUpdatedAt: now - (seed % 600), // within last 10m
    epochCount: 12,
    status,
    liveMaxDrawdownBps: agent ? agent.maxDrawdownBps : 800,
    liveWinRateBps: agent ? agent.winRateBps : 5000,
    liveTotalReturnBps: agent ? agent.totalReturnBps : 0,
    liveSharpeX1000: agent ? agent.sharpeX1000 : 1000,
  };
}

const MOCK_RUNS: Record<string, LiveRun> = {
  "142": mockLiveRun(142n, "active"),
  "287": mockLiveRun(287n, "active"),
  "318": mockLiveRun(318n, "active"),
  "421": mockLiveRun(421n, "stopped"),
  "502": mockLiveRun(502n, "active"),
  "99":  mockLiveRun(99n,  "liquidated"),
};

function mockSeasonById(id: bigint): SeasonSummary | null {
  return MOCK_SEASONS.find((s) => s.id === id) ?? null;
}

function mockSeasonParticipants(id: bigint): bigint[] {
  return MOCK_PARTICIPANTS[id.toString()] ?? [];
}

function mockLiveRunFor(tokenId: bigint): LiveRun | null {
  return MOCK_RUNS[tokenId.toString()] ?? null;
}
