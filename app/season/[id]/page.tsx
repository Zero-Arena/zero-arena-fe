// /season/[id] — live leaderboard for one season. Reads enrolled tokens
// from Season.getParticipants, joins with LiveCertificate.runs for each,
// ranks by liveTotalReturnBps. SSR with revalidate=60 so the page refreshes
// every minute without hammering RPC.

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  readSeason,
  readSeasonLeaderboard,
  type LiveRun,
  type SeasonLeaderboardEntry,
  type SeasonSummary,
} from "@/lib/chain/live";
import { isDeployed, CONTRACTS } from "@/lib/chain/contracts";
import { bpsToPct, fmtPctSigned, fmtPctUnsigned, truncateAddress } from "@/lib/agents";

export const revalidate = 60;

function fmtCountdown(targetTs: number): string {
  const now = Date.now();
  const ms = targetTs * 1000 - now;
  if (ms < 0) return "—";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  return days >= 1 ? `${days}d ${hours}h` : `${hours}h`;
}

function fmtPrize(wei: bigint): string {
  return `${(Number(wei) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 2 })} 0G`;
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusOf(s: SeasonSummary): { label: string; tone: "live" | "scheduled" | "settled" | "ended" } {
  const now = Math.floor(Date.now() / 1000);
  if (s.settled) return { label: "Settled", tone: "settled" };
  if (s.startTime > now) return { label: `Starts in ${fmtCountdown(s.startTime)}`, tone: "scheduled" };
  if (s.endTime > now) return { label: `Ends in ${fmtCountdown(s.endTime)}`, tone: "live" };
  return { label: "Awaiting settlement", tone: "ended" };
}

function RankBadge({ rank }: { rank: number }) {
  const styles =
    rank === 1
      ? "bg-yellow-400 text-zinc-900"
      : rank === 2
        ? "bg-zinc-300 text-zinc-900"
        : rank === 3
          ? "bg-amber-700 text-zinc-50"
          : "bg-zinc-800 text-zinc-400";
  return (
    <span className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-bold ${styles}`}>
      {rank}
    </span>
  );
}

function LeaderboardRow({ entry, rank }: { entry: SeasonLeaderboardEntry; rank: number }) {
  const r: LiveRun | null = entry.run;
  const ret = r ? bpsToPct(r.liveTotalReturnBps) : null;
  const sharpe = r ? r.liveSharpeX1000 / 1000 : null;
  const ddPct = r ? bpsToPct(r.liveMaxDrawdownBps) : null;
  const winPct = r ? bpsToPct(r.liveWinRateBps) : null;

  const statusLabel = r
    ? r.status === "active"
      ? "Live"
      : r.status === "stopped"
        ? "Stopped"
        : "Liquidated"
    : "Not started";
  const statusTone = r?.status === "liquidated"
    ? "text-rose-400"
    : r?.status === "active"
      ? "text-emerald-300"
      : "text-zinc-500";

  return (
    <tr className="transition hover:bg-zinc-900">
      <td className="px-4 py-3"><RankBadge rank={rank} /></td>
      <td className="px-4 py-3">
        <Link href={`/agent/${entry.slug}/live`} className="text-sm font-medium text-zinc-100 hover:text-yellow-300">
          {entry.name}
        </Link>
      </td>
      <td className={`px-4 py-3 text-xs ${statusTone}`}>{statusLabel}</td>
      <td className={`px-4 py-3 text-right tabular-nums ${ret === null ? "text-zinc-600" : ret >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
        {ret === null ? "—" : fmtPctSigned(ret)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
        {sharpe === null ? "—" : sharpe.toFixed(2)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
        {winPct === null ? "—" : fmtPctUnsigned(winPct)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-rose-400">
        {ddPct === null ? "—" : `−${fmtPctUnsigned(ddPct)}`}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
        {r ? r.epochCount : 0}
      </td>
    </tr>
  );
}

function EmptyLeaderboard() {
  return (
    <div className="mt-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-12 text-center">
      <p className="text-sm text-zinc-400">No agents enrolled yet. Be the first.</p>
      <p className="mt-3 text-[11px] text-zinc-500">
        Owner of an iNFT calls{" "}
        <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-300">enroll(seasonId, tokenId)</code>{" "}
        before the start time. After start, agents trade live; rankings refresh every 60 seconds.
      </p>
    </div>
  );
}

function NotDeployedState({ seasonId }: { seasonId: bigint }) {
  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-4xl px-6 py-16 text-center">
        <Link href="/season" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
          ← Seasons
        </Link>
        <h1 className="mt-6 text-2xl font-bold">Season #{seasonId.toString()}</h1>
        <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          <span className="size-1.5 rounded-full bg-amber-400" />
          Season contract not deployed
        </div>
        <p className="mt-6 mx-auto max-w-md text-sm text-zinc-400">
          The Season contract has not yet been deployed to Galileo, so this page cannot read live state.
          Once <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px]">NEXT_PUBLIC_SEASON_ADDRESS</code>{" "}
          is set, the leaderboard renders live.
        </p>
      </div>
    </div>
  );
}

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seasonId = BigInt(id);

  const season = await readSeason(seasonId);
  if (!season) notFound();

  const entries = await readSeasonLeaderboard(seasonId);
  const status = statusOf(season);
  const sourceLabel = isDeployed(CONTRACTS.Season) ? "Galileo live" : "Demo data";
  const sourceTone = isDeployed(CONTRACTS.Season)
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
    : "border-amber-500/40 bg-amber-500/10 text-amber-300";

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Link href="/season" className="hover:text-zinc-300">Seasons</Link>
          <span>/</span>
          <span className="text-zinc-300">#{season.id.toString()}</span>
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Season #{season.id.toString()}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium ${sourceTone}`}>
                {sourceLabel === "Galileo live" && (
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                )}
                {sourceLabel}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium ${
                  status.tone === "live"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : status.tone === "scheduled"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                      : "border-zinc-700 bg-zinc-800 text-zinc-300"
                }`}
              >
                {status.tone === "live" && <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />}
                {status.label}
              </span>
              <span className="text-zinc-500">
                {fmtDate(season.startTime)} → {fmtDate(season.endTime)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Prize Pool</div>
            <div className="mt-0.5 text-2xl font-bold tabular-nums text-yellow-300">{fmtPrize(season.prizePool)}</div>
            <p className="mt-1 text-[11px] text-zinc-500">Top-3 split 50% / 30% / 20%</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Market</div>
            <div className="mt-1 text-sm font-medium text-zinc-100 capitalize">
              {season.market} {season.market === "perp" && `· ${season.maxLeverage}x leverage`}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Initial Balance</div>
            <div className="mt-1 text-sm font-medium tabular-nums text-zinc-100">
              {Number(season.initialBalance).toLocaleString("en-US")} USDT
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Fees / Slippage</div>
            <div className="mt-1 text-sm font-medium tabular-nums text-zinc-100">
              {(season.feeBps / 100).toFixed(2)}% / {(season.slippageBps / 100).toFixed(2)}%
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Participants</div>
            <div className="mt-1 text-sm font-medium tabular-nums text-zinc-100">{season.participantCount}</div>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-zinc-500">
          Created by <span className="font-mono text-zinc-300">{truncateAddress(season.creator)}</span>{" "}
          · datasetSpec <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-zinc-300">{season.datasetSpec.slice(0, 12)}…</code>
        </div>

        {entries.length === 0 ? (
          <EmptyLeaderboard />
        ) : (
          <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900/60 text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Live Return</th>
                  <th className="px-4 py-3 text-right font-medium">Sharpe</th>
                  <th className="px-4 py-3 text-right font-medium">Win Rate</th>
                  <th className="px-4 py-3 text-right font-medium">Max DD</th>
                  <th className="px-4 py-3 text-right font-medium">Epochs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {entries.map((e, i) => (
                  <LeaderboardRow key={e.tokenId.toString()} entry={e} rank={i + 1} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
