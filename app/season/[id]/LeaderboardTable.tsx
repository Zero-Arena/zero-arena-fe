"use client";

// Client wrapper around the season leaderboard table that overlays live
// off-chain metrics (from the onboard service `/state/:tokenId` endpoint)
// on top of the SSR-rendered chain-derived values. When a token's daemon
// is active, the row's Live Return / Sharpe / Win Rate / Max DD cells
// refresh every ~1.5s with the wall-clock-accurate value; when the daemon
// is offboarded or never ran, the chain value remains the displayed source.
//
// Why server-rendered fallback matters: chain reads happen at SSR time
// (no JS required, no flicker), and the verifiability story stays intact
// for users with JS disabled or slow connections. The live overlay is a
// pure UX enhancement layered on top.

import Link from "next/link";
import type { SeasonLeaderboardEntry } from "@/lib/chain/live";
import { bpsToPct, fmtPctSigned, fmtPctUnsigned } from "@/lib/agents";
import { useLiveStates } from "@/lib/hooks/useLiveStates";
import {
  pickMaxDrawdownBps,
  pickReturnBps,
  pickSharpeX1000,
  pickWinRateBps,
  type LiveState,
} from "@/lib/be/live-state";

function RankBadge({ rank }: { rank: number }) {
  const styles =
    rank === 1
      ? "bg-green-400 text-zinc-900"
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

function LiveDot({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span
      title="Real-time off-chain stream"
      className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-emerald-400 align-middle"
    />
  );
}

function LeaderboardRow({
  entry,
  rank,
  live,
}: {
  entry: SeasonLeaderboardEntry;
  rank: number;
  live: LiveState | undefined;
}) {
  const r = entry.run;
  const liveActive = Boolean(live?.active && live?.liveMetrics);

  // Chain fallback values (always present from SSR even when no live data).
  const chainRetBps = r?.liveTotalReturnBps ?? 0;
  const chainSharpeX1000 = r?.liveSharpeX1000 ?? 0;
  const chainDdBps = r?.liveMaxDrawdownBps ?? 0;
  const chainWinBps = r?.liveWinRateBps ?? 0;

  const ret = r === null ? null : pickReturnBps(live, chainRetBps);
  const sharpe = r === null ? null : pickSharpeX1000(live, chainSharpeX1000);
  const dd = r === null ? null : pickMaxDrawdownBps(live, chainDdBps);
  const win = r === null ? null : pickWinRateBps(live, chainWinBps);

  const statusLabel = r
    ? r.status === "active"
      ? liveActive
        ? "Live"
        : "Active"
      : r.status === "stopped"
        ? "Stopped"
        : "Liquidated"
    : "Not started";
  const statusTone = r?.status === "liquidated"
    ? "text-rose-400"
    : r?.status === "active"
      ? "text-emerald-300"
      : "text-zinc-500";

  const retPct = ret === null ? null : bpsToPct(ret.value);
  const sharpeVal = sharpe === null ? null : sharpe.value / 1000;
  const ddPct = dd === null ? null : bpsToPct(dd.value);
  const winPct = win === null ? null : bpsToPct(win.value);

  return (
    <tr className="transition hover:bg-zinc-900">
      <td className="px-4 py-3"><RankBadge rank={rank} /></td>
      <td className="px-4 py-3">
        <Link href={`/agent/${entry.slug}/live`} className="text-sm font-medium text-zinc-100 hover:text-green-300">
          {entry.name}
        </Link>
      </td>
      <td className={`px-4 py-3 text-xs ${statusTone}`}>
        {statusLabel}
        <LiveDot active={liveActive} />
      </td>
      <td
        className={`px-4 py-3 text-right tabular-nums ${
          retPct === null ? "text-zinc-600" : retPct >= 0 ? "text-emerald-400" : "text-rose-400"
        }`}
      >
        {retPct === null ? "—" : fmtPctSigned(retPct)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
        {sharpeVal === null ? "—" : fmtSharpe(sharpeVal)}
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

/**
 * Sharpe display formatter — clamp the huge values that fall out of
 * annualizing per-second returns (barsPerYear = 31M for 1s interval makes
 * raw sharpe magnitude unbounded). Anything beyond ±999 collapses to that
 * cap so the cell stays a fixed width.
 */
function fmtSharpe(s: number): string {
  if (!Number.isFinite(s)) return "—";
  if (s > 999) return ">999";
  if (s < -999) return "<-999";
  return s.toFixed(2);
}

export default function LeaderboardTable({
  entries,
}: {
  entries: SeasonLeaderboardEntry[];
}) {
  // Only poll for tokens with an actually-active live run; tokens that
  // haven't started or that liquidated won't change via /state anyway, so
  // skipping them keeps the request volume tight.
  const liveTokenIds = entries
    .filter((e) => e.run?.status === "active")
    .map((e) => e.tokenId);

  const { states, enabled, error } = useLiveStates(liveTokenIds);

  // Re-rank by the displayed Live Return value (live-overlay-aware) so the
  // leaderboard order shifts as the off-chain stream updates, not only at
  // each on-chain epoch commit.
  const ranked = [...entries].sort((a, b) => {
    const la = states.get(a.tokenId.toString());
    const lb = states.get(b.tokenId.toString());
    const ra = la?.active && la.liveMetrics ? la.liveMetrics.totalReturnBps : (a.run?.liveTotalReturnBps ?? Number.NEGATIVE_INFINITY);
    const rb = lb?.active && lb.liveMetrics ? lb.liveMetrics.totalReturnBps : (b.run?.liveTotalReturnBps ?? Number.NEGATIVE_INFINITY);
    return rb - ra;
  });

  return (
    <div className="mt-8">
      {enabled && (
        <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-500">
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live overlay active · polling every 1.5s · chain anchor every epoch
        </div>
      )}
      {error !== null && (
        <div className="mb-2 text-[11px] text-amber-400">
          Live overlay unavailable — showing chain values only.
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40">
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
            {ranked.map((e, i) => (
              <LeaderboardRow
                key={e.tokenId.toString()}
                entry={e}
                rank={i + 1}
                live={states.get(e.tokenId.toString())}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
