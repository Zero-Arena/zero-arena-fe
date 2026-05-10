import Link from "next/link";
import {
  agents,
  bpsToPct,
  fmtPctSigned,
  fmtPctUnsigned,
  marketLabel,
  truncateAddress,
  TRUST_TIER_INFO,
  type Agent,
  type Trend,
  type TrustTier,
} from "@/lib/agents";

function Sparkline({ series, trend }: { series: number[]; trend: Trend }) {
  const w = 120;
  const h = 44;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const step = w / (series.length - 1);
  const points = series.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / span) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = `M ${points.join(" L ")}`;
  const stroke =
    trend === "down" ? "#ef4444" : trend === "mixed" ? "#f59e0b" : "#22c55e";
  const fillId = `spark-${trend}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${w},${h} L 0,${h} Z`} fill={`url(#${fillId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
}

function ShieldIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1l6 2v5.2c0 3-2.5 5.7-6 6.8-3.5-1.1-6-3.8-6-6.8V3l6-2zm-.7 9.5l4-4-1-1-3 3-1.3-1.3-1 1L7.3 10.5z" />
    </svg>
  );
}

function TierBadge({ tier }: { tier: TrustTier }) {
  const info = TRUST_TIER_INFO[tier];
  return (
    <span
      title={info.tagline}
      className={`inline-flex items-center gap-1 rounded ${info.bg} px-1.5 py-0.5 text-[10px] font-medium ${info.color} ring-1 ${info.ring}`}
    >
      <ShieldIcon className="size-3" />
      {info.label.split(" · ")[0]}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg className="size-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg className="size-3 text-zinc-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4.5l3 3 3-3" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg className="size-4 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}

function AgentCard({ a }: { a: Agent }) {
  const totalReturn = bpsToPct(a.totalReturnBps);
  const sharpe = a.sharpeX1000 / 1000;
  const mdd = bpsToPct(a.maxDrawdownBps);
  const winRate = bpsToPct(a.winRateBps);
  const returnColor = totalReturn >= 0 ? "text-emerald-400" : "text-rose-400";

  return (
    <Link
      href={`/agent/${a.slug}`}
      className="group block rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 transition hover:border-zinc-700 hover:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${a.avatarFrom} ${a.avatarTo} text-sm font-semibold text-white`}
          >
            {a.initial}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-zinc-100">{a.name}</span>
              <TierBadge tier={a.trustTier} />
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
              <span>by {truncateAddress(a.authorFull)}</span>
              <span className="ml-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                {a.strategyClass}
              </span>
            </div>
          </div>
        </div>
        <span className="shrink-0 rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-300">
          {marketLabel(a)}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-zinc-500">30D Total Return</div>
          <div className={`mt-1 truncate text-2xl font-semibold tabular-nums ${returnColor}`}>
            {fmtPctSigned(totalReturn)}
          </div>
        </div>
        <div className="shrink-0">
          <Sparkline series={a.sparkline} trend={a.trend} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-[11px] text-zinc-500">Sharpe</div>
          <div className="mt-0.5 font-medium tabular-nums text-zinc-200">{sharpe.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-500">Max DD</div>
          <div className="mt-0.5 font-medium tabular-nums text-zinc-200">−{fmtPctUnsigned(mdd)}</div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-500">Win Rate</div>
          <div className="mt-0.5 font-medium tabular-nums text-zinc-200">{fmtPctUnsigned(winRate)}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2 text-[11px] text-zinc-400">
        <span>
          Cert <span className="font-mono text-zinc-300">#{a.certId}</span>
        </span>
        <span className="font-mono text-zinc-300">
          {a.mints} mint{a.mints === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <span className="rounded-lg bg-zinc-800 py-2 text-center text-sm font-medium text-zinc-200 transition group-hover:bg-zinc-700">
          Inspect
        </span>
        <span className="rounded-lg bg-yellow-400 py-2 text-center text-sm font-semibold text-zinc-900 transition group-hover:bg-yellow-300">
          Mint iNFT
        </span>
      </div>
    </Link>
  );
}

export default function AgentRegistryPage() {
  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Agent Registry</h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-400">
              Verifiable backtest certificates for AI trading agents. Strategy stays sealed —
              metrics are committed on-chain.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1">Network: 0G Galileo Testnet</span>
            <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1">{agents.length} agents</span>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-6 border-b border-zinc-900 text-sm">
          <button className="relative pb-3 font-semibold text-zinc-100">
            All Agents
            <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-yellow-400" />
          </button>
          <button className="pb-3 text-zinc-400 hover:text-zinc-200">My Mints</button>
          <button className="pb-3 text-zinc-400 hover:text-zinc-200">Watchlist</button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-700">
              All Tiers <ChevronDown />
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-700">
              All Markets <ChevronDown />
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-700">
              30 Days <ChevronDown />
            </button>
            <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
              <span className="relative flex size-4 items-center justify-center rounded border border-zinc-600 bg-zinc-900">
                <svg className="size-3 text-yellow-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2.5 6.2L4.8 8.5 9.5 3.5" />
                </svg>
              </span>
              <span className="border-b border-dashed border-zinc-600 pb-px">Reproducible only</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <SearchIcon />
              </span>
              <input
                type="text"
                placeholder="Agent name or address"
                className="w-64 rounded-lg border border-zinc-800 bg-zinc-900 py-1.5 pl-9 pr-3 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none"
              />
            </div>
            <button aria-label="Filters" className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 hover:border-zinc-700">
              <FilterIcon />
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <AgentCard key={a.slug} a={a} />
          ))}
        </div>

        <p className="mt-8 text-[11px] text-zinc-500">
          Demo data on 0G Galileo testnet. Trust tier T1 = on-chain commitment, T2 = owner-shared
          reproducibility, T3 = TEE-attested via 0G Compute Sealed Inference (v0.2).
        </p>
      </div>
    </div>
  );
}
