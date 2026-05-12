// Readers for the v0.3 paper-trading contracts (RFC-001). Every reader
// short-circuits when the relevant address is the zero-placeholder — that
// way the FE renders graceful empty states until LiveCertificate and
// Season actually deploy to Galileo. Once deployed, set the env vars
//   NEXT_PUBLIC_LIVE_CERTIFICATE_ADDRESS
//   NEXT_PUBLIC_SEASON_ADDRESS
// and these readers light up with zero code changes.

import { publicClient } from "./client";
import {
  CONTRACTS,
  LIVE_CERTIFICATE_ABI,
  SEASON_ABI,
  isDeployed,
  marketFromByte,
  statusFromByte,
} from "./contracts";

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
  if (!isDeployed(CONTRACTS.LiveCertificate)) return null;
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
  if (!isDeployed(CONTRACTS.Season)) return [];

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
  if (!isDeployed(CONTRACTS.Season)) return null;
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
  if (!isDeployed(CONTRACTS.Season)) return [];
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
  run: LiveRun | null;
}

export async function readSeasonLeaderboard(seasonId: bigint): Promise<SeasonLeaderboardEntry[]> {
  const participants = await readSeasonParticipants(seasonId);
  if (participants.length === 0) return [];
  const runs = await Promise.all(participants.map((t) => readLiveRun(t)));
  const entries: SeasonLeaderboardEntry[] = participants.map((tokenId, i) => ({
    tokenId,
    run: runs[i] ?? null,
  }));
  // Rank by liveTotalReturnBps desc; nulls (no run started) sink to the bottom.
  entries.sort((a, b) => {
    const ra = a.run?.liveTotalReturnBps ?? Number.NEGATIVE_INFINITY;
    const rb = b.run?.liveTotalReturnBps ?? Number.NEGATIVE_INFINITY;
    return rb - ra;
  });
  return entries;
}
