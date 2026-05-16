// /agent/[slug]/live — per-agent paper-run dashboard. Shows the static
// cert reference, live cumulativeHash + epoch count, live metrics, and a
// "How the chain extends" diagram. Empty state if the LiveCertificate
// contract isn't deployed or this iNFT hasn't started a paper run.

import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchAgent, bpsToPct, fmtPctSigned, fmtPctUnsigned, truncateAddress, truncateHash } from "@/lib/agents";
import { readLiveRun } from "@/lib/chain/live";
import { isDeployed, CONTRACTS } from "@/lib/chain/contracts";
import { explorerUrl } from "@/lib/chain/galileo";
import { inferOperatorBadge } from "@/lib/chain/operators";
import { OperatorBadge } from "@/app/_components/OperatorBadge";

export const revalidate = 60;

function fmtAge(sec: number): string {
  const diff = Math.floor(Date.now() / 1000) - sec;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotStartedState({ slug, tokenId }: { slug: string; tokenId: string }) {
  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-4xl px-6 py-16 text-center">
        <Link href={`/agent/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
          ← Back to agent
        </Link>
        <h1 className="mt-6 text-2xl font-bold">Live track record — Agent #{tokenId}</h1>
        <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          <span className="size-1.5 rounded-full bg-amber-400" />
          No paper run started
        </div>
        <p className="mt-6 mx-auto max-w-md text-sm text-zinc-400">
          This agent has a static certificate on Galileo but has not yet started a paper-trading run.
          Once the owner calls <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">LiveCertificate.start(tokenId)</code>{" "}
          and the operator daemon starts feeding live bars, this page lights up with the cumulative hash chain.
        </p>
      </div>
    </div>
  );
}

export default async function AgentLivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await fetchAgent(slug);
  if (!agent) notFound();

  const tokenId = BigInt(agent.tokenId);
  // readLiveRun handles the not-deployed case internally — when the
  // LiveCertificate contract is the zero placeholder it falls back to
  // mock fixtures so the dashboard is demonstrable for hackathon judges.
  const live = await readLiveRun(tokenId);
  const sourceLabel = isDeployed(CONTRACTS.LiveCertificate) ? "Galileo live" : "Demo data";

  if (!live) {
    return <NotStartedState slug={slug} tokenId={agent.tokenId.toString()} />;
  }

  const ret = bpsToPct(live.liveTotalReturnBps);
  const sharpe = live.liveSharpeX1000 / 1000;
  const dd = bpsToPct(live.liveMaxDrawdownBps);
  const win = bpsToPct(live.liveWinRateBps);
  const returnColor = ret >= 0 ? "text-emerald-400" : "text-rose-400";

  const statusTone = {
    active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    stopped: "border-zinc-700 bg-zinc-800 text-zinc-300",
    liquidated: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  }[live.status];

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <Link href={`/agent/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
          ← {agent.name}
        </Link>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-zinc-500">Live paper-run dashboard</div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                  sourceLabel === "Galileo live"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                }`}
              >
                {sourceLabel === "Galileo live" && (
                  <span className="size-1 animate-pulse rounded-full bg-emerald-400" />
                )}
                {sourceLabel}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{agent.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium ${statusTone}`}>
                {live.status === "active" && <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />}
                {live.status === "active" ? "Live" : live.status === "stopped" ? "Stopped" : "Liquidated"}
              </span>
              <OperatorBadge
                info={inferOperatorBadge({ ownerAddress: agent.currentOwner, attestationHash: agent.attestationHash })}
                size="md"
              />
              <span className="text-zinc-500">
                Started {fmtAge(live.startedAt)} · {live.epochCount} {live.epochCount === 1 ? "epoch" : "epochs"} committed · last update {fmtAge(live.lastUpdatedAt)}
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Live ROI</div>
            <div className={`mt-1 text-3xl font-bold tabular-nums ${returnColor}`}>{fmtPctSigned(ret)}</div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Live Sharpe</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">{sharpe.toFixed(2)}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Live Win Rate</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">{fmtPctUnsigned(win)}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Max Drawdown</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-rose-400">−{fmtPctUnsigned(dd)}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Epochs Committed</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">{live.epochCount}</div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
            <div className="text-sm font-semibold text-zinc-100">Hash chain</div>
            <p className="mt-2 text-[11px] leading-5 text-zinc-500">
              Every epoch extends a Merkle-like chain starting from the static cert&apos;s{" "}
              <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-zinc-300">runHash</code>.
              Replay <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-zinc-300">keccak(prev || epochHash)</code>{" "}
              over all {live.epochCount} epochs to verify the on-chain cumulativeHash.
            </p>
            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500">Genesis (static runHash)</span>
                <a
                  href={explorerUrl("tx", agent.runHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] text-zinc-300 hover:text-zinc-100"
                >
                  {truncateHash(agent.runHash, 10, 8)} ↗
                </a>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500">Cumulative (current)</span>
                <span className="font-mono text-[11px] text-emerald-300" title={live.cumulativeHash}>
                  {truncateHash(live.cumulativeHash, 10, 8)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500">Owner</span>
                <a
                  href={explorerUrl("address", agent.currentOwner)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] text-zinc-300 hover:text-zinc-100"
                >
                  {truncateAddress(agent.currentOwner)} ↗
                </a>
              </div>
            </div>
            <a
              href={explorerUrl("address", CONTRACTS.LiveCertificate)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950/40 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-600"
            >
              View LiveCertificate on Galileo ↗
            </a>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
            <div className="text-sm font-semibold text-zinc-100">How this row gets updated</div>
            <ol className="mt-4 space-y-3 text-xs">
              <li className="flex items-start gap-3">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300">1</span>
                <span className="text-zinc-400">
                  Operator daemon (<code className="font-mono text-zinc-200">bacend paper start</code>) subscribes to a Binance kline stream for{" "}
                  <code className="font-mono text-zinc-200">BTCUSDT@15m</code>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300">2</span>
                <span className="text-zinc-400">
                  Each closed bar is fed to the same{" "}
                  <code className="font-mono text-zinc-200">PaperEngine</code> that produced the static cert &mdash; byte-equal indicator math, same fee schedule.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300">3</span>
                <span className="text-zinc-400">
                  Every <code className="font-mono text-zinc-200">barsPerEpoch</code> bars, the daemon builds an{" "}
                  <code className="font-mono text-zinc-200">EpochCommit</code> and submits to{" "}
                  <code className="font-mono text-zinc-200">LiveCertificate.update()</code>. The on-chain cumulativeHash extends.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300">4</span>
                <span className="text-zinc-400">
                  This page re-fetches every 60s and renders whatever the chain currently says.
                </span>
              </li>
            </ol>
            <p className="mt-4 text-[11px] italic text-zinc-500">
              v0.4 swaps the operator&apos;s wallet for a TEE attestation quote (0G Compute Sealed Inference) — the
              ABI and chain layout do not change.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
