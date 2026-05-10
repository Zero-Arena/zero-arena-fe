import Link from "next/link";
import { notFound } from "next/navigation";
import {
  bpsToPct,
  fmtMoney,
  fmtPctSigned,
  fmtPctUnsigned,
  generateChartSeries,
  getAgent,
  marketLabel,
  truncateAddress,
  truncateHash,
  TRUST_TIER_INFO,
  type Agent,
  type TrustTier,
} from "@/lib/agents";
import PerformanceChart from "./PerformanceChart";

function ShieldIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1l6 2v5.2c0 3-2.5 5.7-6 6.8-3.5-1.1-6-3.8-6-6.8V3l6-2zm-.7 9.5l4-4-1-1-3 3-1.3-1.3-1 1L7.3 10.5z" />
    </svg>
  );
}

function ChevronDown({ className = "size-3" }: { className?: string }) {
  return (
    <svg className={`${className} text-zinc-400`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4.5l3 3 3-3" />
    </svg>
  );
}

function ExternalIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M14 4h6v6M10 14L20 4M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5" />
    </svg>
  );
}

function StatRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-zinc-500 underline decoration-dotted decoration-zinc-700 underline-offset-4">
        {label}
      </span>
      <span className={`tabular-nums ${valueClass ?? "text-zinc-200"}`}>{value}</span>
    </div>
  );
}

function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-zinc-500 underline decoration-dotted decoration-zinc-700 underline-offset-4">
        {label}
      </span>
      <span className="font-mono text-[11px] text-zinc-300" title={value}>
        {truncateHash(value, 10, 8)}
      </span>
    </div>
  );
}

function TrustTierCard({ tier }: { tier: TrustTier }) {
  const info = TRUST_TIER_INFO[tier];
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg ${info.bg} px-3 py-1.5 text-xs font-semibold ${info.color} ring-1 ${info.ring}`}
    >
      <ShieldIcon className="size-3.5" />
      {info.label}
    </div>
  );
}

function OutcomeDonut({
  wins,
  losses,
  liquidations,
}: {
  wins: number;
  losses: number;
  liquidations: number;
}) {
  const size = 160;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const total = wins + losses + liquidations || 1;
  const circumference = 2 * Math.PI * radius;
  const slices = [
    { color: "#22c55e", count: wins },
    { color: "#ef4444", count: losses },
    { color: "#a78bfa", count: liquidations },
  ].filter((s) => s.count > 0);
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#27272a" strokeWidth={stroke} />
      {slices.map((s, i) => {
        const length = (s.count / total) * circumference;
        const arc = (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        );
        offset += length;
        return arc;
      })}
    </svg>
  );
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a: Agent | undefined = getAgent(slug);
  if (!a) notFound();

  const totalReturn = bpsToPct(a.totalReturnBps);
  const sharpe = a.sharpeX1000 / 1000;
  const mdd = bpsToPct(a.maxDrawdownBps);
  const winRate = bpsToPct(a.winRateBps);
  const losses = a.totalPositions - a.winPositions - (a.liquidations ?? 0);
  const series = generateChartSeries(totalReturn);
  const returnColor = totalReturn >= 0 ? "text-emerald-400" : "text-rose-400";
  const tierInfo = TRUST_TIER_INFO[a.trustTier];

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Agent Registry
        </Link>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300">{marketLabel(a)}</span>
            <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300">
              {a.strategyClass}
            </span>
            <TrustTierCard tier={a.trustTier} />
          </div>
          <div className="flex items-center gap-2 text-zinc-300">
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs hover:border-zinc-700">
              <ShieldIcon className="size-3.5" />
              {a.mints} mints
            </button>
            <a
              href="#"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs hover:border-zinc-700"
            >
              <ExternalIcon /> 0G Explorer
            </a>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div
              className={`flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${a.avatarFrom} ${a.avatarTo} text-xl font-semibold text-white`}
            >
              {a.initial}
            </div>
            <div className="max-w-2xl">
              <h1 className="text-2xl font-semibold text-zinc-100">{a.name}</h1>
              <div className="mt-1 text-xs text-zinc-500">
                Author <span className="font-mono text-zinc-300">{truncateAddress(a.authorFull)}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{a.description}</p>
              <p className="mt-3 text-[11px] italic text-zinc-500">
                {tierInfo.tagline}
              </p>
            </div>
          </div>

          <div className="flex w-full max-w-[180px] flex-col gap-2">
            <button className="rounded-lg bg-yellow-400 py-2 text-sm font-semibold text-zinc-900 hover:bg-yellow-300">
              Mint iNFT
            </button>
            <button className="rounded-lg border border-zinc-700 bg-zinc-900 py-2 text-sm font-medium text-zinc-200 hover:border-zinc-600">
              Clone & Re-run
            </button>
            <button className="rounded-lg border border-zinc-700 bg-zinc-900 py-2 text-sm font-medium text-zinc-200 hover:border-zinc-600">
              Verify Run
            </button>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-100">Performance</div>
              <button className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200">
                30 Days <ChevronDown />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-y-4">
              <div>
                <div className="text-[11px] text-zinc-500 underline decoration-dotted decoration-zinc-700 underline-offset-4">
                  Total Return
                </div>
                <div className={`mt-1 text-base font-semibold tabular-nums ${returnColor}`}>
                  {fmtPctSigned(totalReturn)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-zinc-500 underline decoration-dotted decoration-zinc-700 underline-offset-4">
                  Sharpe
                </div>
                <div className="mt-1 text-base font-semibold tabular-nums text-zinc-100">{sharpe.toFixed(2)}</div>
              </div>
            </div>
            <div className="mt-3 space-y-2.5">
              <StatRow label="Max Drawdown" value={`−${fmtPctUnsigned(mdd)}`} valueClass="text-rose-400" />
              <StatRow label="Win Rate" value={fmtPctUnsigned(winRate)} />
              <StatRow label="Win Positions" value={a.winPositions.toString()} />
              <StatRow label="Total Positions" value={a.totalPositions.toString()} />
              {a.liquidations !== undefined && (
                <StatRow
                  label="Liquidations"
                  value={a.liquidations.toString()}
                  valueClass={a.liquidations > 0 ? "text-rose-400" : "text-zinc-200"}
                />
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
            <div className="h-[280px]">
              <PerformanceChart data={series} initialBalance={a.initialBalance} />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-100">Certificate</div>
              <span className="font-mono text-xs text-zinc-400">#{a.certId}</span>
            </div>
            <div className="mt-4 space-y-2.5">
              <StatRow label="Trust Tier" value={tierInfo.label} valueClass={tierInfo.color} />
              <HashRow label="runHash" value={a.runHash} />
              <HashRow label="datasetHash" value={a.datasetHash} />
              <HashRow label="storageRootHash" value={a.storageRootHash} />
              {a.attestationHash ? (
                <HashRow label="attestationHash" value={a.attestationHash} />
              ) : (
                <StatRow label="attestationHash" value="— (T3 only)" valueClass="text-zinc-500" />
              )}
              <StatRow label="Submitted" value={a.createdAt} />
              <StatRow label="Owner" value={truncateAddress(a.currentOwner)} valueClass="font-mono text-zinc-200" />
            </div>
            <a
              href="#"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950/40 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-600"
            >
              <ExternalIcon className="size-3" /> View on 0G Galileo Explorer
            </a>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-100">Backtest Configuration</div>
              <span className="text-xs text-zinc-500">deterministic</span>
            </div>
            <div className="mt-4 space-y-2.5">
              <StatRow label="Market" value={a.market === "perp" ? "Futures (perpetual)" : "Spot"} />
              <StatRow label="Asset" value={`${a.asset}/USDT`} />
              {a.market === "perp" && (
                <StatRow
                  label="Leverage"
                  value={`${a.leverage}x isolated`}
                  valueClass="text-amber-400"
                />
              )}
              <StatRow label="Initial Balance" value={`${fmtMoney(a.initialBalance)} USDT`} />
              <StatRow label="Taker Fee" value={`${(a.feeBps / 100).toFixed(2)}%`} />
              <StatRow label="Slippage" value={`${(a.slippageBps / 100).toFixed(2)}%`} />
              <StatRow label="Granularity" value="1h candles" />
              <StatRow label="Window" value="last 365 days" />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-100">iNFT</div>
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">ERC-7857</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-[11px] text-zinc-500">Token ID</div>
                <div className="mt-0.5 font-mono text-zinc-200">#{a.tokenId}</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500">Mints</div>
                <div className="mt-0.5 font-medium text-zinc-200">{a.mints}</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500">Owner</div>
                <div className="mt-0.5 font-mono text-zinc-200">{truncateAddress(a.currentOwner)}</div>
              </div>
            </div>
            <p className="mt-4 text-[11px] leading-5 text-zinc-500">
              Transfers route through the ReencryptionOracle so a new owner receives a re-encrypted
              copy of the agent without ever seeing the underlying source. Vanilla ERC-721
              transferFrom is disabled for tokens with encrypted metadata.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
                Trade Outcomes
              </div>
              <button className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200">
                30 Days <ChevronDown />
              </button>
            </div>
            <div className="mt-4 flex items-center justify-around gap-4">
              <OutcomeDonut wins={a.winPositions} losses={losses} liquidations={a.liquidations ?? 0} />
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span className="w-12 text-zinc-400">Wins</span>
                  <span className="tabular-nums text-zinc-200">{a.winPositions}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-rose-500" />
                  <span className="w-12 text-zinc-400">Losses</span>
                  <span className="tabular-nums text-zinc-200">{losses}</span>
                </div>
                {a.liquidations !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-violet-400" />
                    <span className="w-12 text-zinc-400">Liq.</span>
                    <span className="tabular-nums text-zinc-200">{a.liquidations}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-6 border-b border-zinc-800 text-sm">
          {[
            { label: "Trades", active: true },
            { label: "Certificate", active: false },
            { label: "Mint History", active: false },
            { label: "Owners", active: false },
          ].map((tab) => (
            <button
              key={tab.label}
              className={`relative pb-3 ${tab.active ? "font-semibold text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              {tab.label}
              {tab.active && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-yellow-400" />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-full border border-zinc-700 text-zinc-500">
            <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="6" y="11" width="12" height="9" rx="1.5" />
              <path d="M9 11V8a3 3 0 016 0v3" />
            </svg>
          </div>
          <p className="mt-4 max-w-sm text-xs leading-5 text-zinc-500">
            Trade-by-trade detail is sealed inside the encrypted run log on 0G Storage. Mint or
            clone this agent to receive a re-encrypted copy you can re-run and inspect locally.
          </p>
        </div>
      </div>
    </div>
  );
}
