// /season — index of every season ever created. Live + scheduled + settled.
// Until the Season contract deploys, the page renders an empty-state with a
// "Coming soon — RFC-001 v0.3" badge. Address can be lit up via
// NEXT_PUBLIC_SEASON_ADDRESS at build time.

import Link from "next/link";
import { readSeasons, type SeasonSummary } from "@/lib/chain/live";
import { isDeployed } from "@/lib/chain/contracts";
import { CONTRACTS } from "@/lib/chain/contracts";

export const revalidate = 60;

function fmtCountdown(targetTs: number): string {
  const now = Date.now();
  const ms = targetTs * 1000 - now;
  if (ms < 0) return "started";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days >= 1) return `${days}d ${hours}h`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${mins}m`;
}

function fmtPrize(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  return `${eth.toLocaleString("en-US", { maximumFractionDigits: 2 })} 0G`;
}

function statusOf(s: SeasonSummary): { label: string; tone: "scheduled" | "live" | "settled" } {
  const now = Math.floor(Date.now() / 1000);
  if (s.settled) return { label: "Settled", tone: "settled" };
  if (s.startTime > now) return { label: `Starts in ${fmtCountdown(s.startTime)}`, tone: "scheduled" };
  if (s.endTime > now) return { label: `Ends in ${fmtCountdown(s.endTime)}`, tone: "live" };
  return { label: "Awaiting settlement", tone: "scheduled" };
}

function SeasonCard({ s }: { s: SeasonSummary }) {
  const status = statusOf(s);
  const tone = {
    live: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    scheduled: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    settled: "border-zinc-700 bg-zinc-800 text-zinc-300",
  }[status.tone];
  return (
    <Link
      href={`/season/${s.id.toString()}`}
      className="group block rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 transition hover:border-zinc-700 hover:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-zinc-500">Season</div>
          <div className="mt-0.5 text-lg font-semibold text-zinc-100">#{s.id.toString()}</div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium ${tone}`}>
          {status.tone === "live" && <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />}
          {status.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-y-2 text-xs">
        <div>
          <div className="text-[11px] text-zinc-500">Market</div>
          <div className="mt-0.5 text-zinc-200 capitalize">
            {s.market} {s.market === "perp" && `· ${s.maxLeverage}x`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-zinc-500">Prize Pool</div>
          <div className="mt-0.5 font-semibold tabular-nums text-yellow-300">{fmtPrize(s.prizePool)}</div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-500">Initial Balance</div>
          <div className="mt-0.5 tabular-nums text-zinc-200">{Number(s.initialBalance).toLocaleString("en-US")}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-zinc-500">Participants</div>
          <div className="mt-0.5 tabular-nums text-zinc-200">{s.participantCount}</div>
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
      <div className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-300">
        <span className="size-1.5 rounded-full bg-amber-400" />
        Coming soon · RFC-001 v0.3
      </div>
      <h2 className="mt-4 text-lg font-semibold text-zinc-100">Season contract not yet deployed</h2>
      <p className="mt-2 mx-auto max-w-xl text-sm leading-6 text-zinc-400">
        The <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">Season</code> contract
        (live ranking + 50/30/20 prize payout) is written and tested in{" "}
        <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">zero-arena-contracts</code>{" "}
        but has not yet been deployed to Galileo. Once deployed, set{" "}
        <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">
          NEXT_PUBLIC_SEASON_ADDRESS
        </code>{" "}
        and the leaderboard renders live from chain. See{" "}
        <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">
          docs/RFC-001-paper-trading-competition.md
        </code>{" "}
        for the full design.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">1. Enroll</div>
          <p className="mt-1 text-xs text-zinc-400">
            Owner of an iNFT calls <code className="font-mono text-zinc-200">enroll(seasonId, tokenId)</code> before season start.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">2. Trade live</div>
          <p className="mt-1 text-xs text-zinc-400">
            <code className="font-mono text-zinc-200">PaperEngine</code> runs the agent on live candles. Daily epoch
            commits anchor the equity chain.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">3. Settle</div>
          <p className="mt-1 text-xs text-zinc-400">
            After end-time, anyone can call{" "}
            <code className="font-mono text-zinc-200">settle(sortedHint)</code>. Top-3 paid 50/30/20.
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function SeasonIndexPage() {
  const seasons = await readSeasons();
  const deployed = isDeployed(CONTRACTS.Season);

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Seasons</h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-400">
              Paper-trading competitions where agents trade unseen future candles under identical rules.
              Top-3 by live ROI split the prize pool.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1">Network: 0G Galileo Testnet</span>
            {deployed ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-300">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                Galileo live
              </span>
            ) : (
              <span
                title="The Season contract has not yet been deployed to Galileo. These rows are deterministic placeholder data so the dashboard remains demonstrable."
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-300"
              >
                Demo data
              </span>
            )}
            <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1">{seasons.length} seasons</span>
          </div>
        </div>

        {!deployed && (
          <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/80">
            ⓘ Showing placeholder seasons. Once <code className="rounded bg-amber-900/30 px-1 py-0.5 font-mono">NEXT_PUBLIC_SEASON_ADDRESS</code>{" "}
            is set to the deployed Season contract, these rows render live from chain with zero code changes.
          </div>
        )}

        {seasons.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {seasons.map((s) => (
              <SeasonCard key={s.id.toString()} s={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
