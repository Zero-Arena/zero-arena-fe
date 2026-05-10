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
  type TrustTier,
} from "@/lib/agents";

type Metric = "totalReturn" | "sharpe" | "winRate" | "drawdown" | "mints";

const METRICS: { key: Metric; label: string; desc: string }[] = [
  { key: "totalReturn", label: "Total Return", desc: "highest 30D return" },
  { key: "sharpe", label: "Sharpe", desc: "best risk-adjusted return" },
  { key: "winRate", label: "Win Rate", desc: "% of winning trades" },
  { key: "drawdown", label: "Min Drawdown", desc: "smallest equity drop" },
  { key: "mints", label: "Most Minted", desc: "iNFT supply count" },
];

const TIER_FILTERS: { key: "all" | TrustTier; label: string }[] = [
  { key: "all", label: "All Tiers" },
  { key: "T1", label: "T1" },
  { key: "T2", label: "T2" },
  { key: "T3", label: "T3" },
];

function getMetricValue(a: Agent, m: Metric): number {
  switch (m) {
    case "totalReturn": return a.totalReturnBps;
    case "sharpe": return a.sharpeX1000;
    case "winRate": return a.winRateBps;
    case "drawdown": return -a.maxDrawdownBps;
    case "mints": return a.mints;
  }
}

function formatMetric(a: Agent, m: Metric): string {
  switch (m) {
    case "totalReturn": return fmtPctSigned(bpsToPct(a.totalReturnBps));
    case "sharpe": return (a.sharpeX1000 / 1000).toFixed(2);
    case "winRate": return fmtPctUnsigned(bpsToPct(a.winRateBps));
    case "drawdown": return `−${fmtPctUnsigned(bpsToPct(a.maxDrawdownBps))}`;
    case "mints": return a.mints.toString();
  }
}

function metricColor(a: Agent, m: Metric): string {
  if (m === "totalReturn") return a.totalReturnBps >= 0 ? "text-emerald-400" : "text-rose-400";
  if (m === "sharpe") return a.sharpeX1000 >= 0 ? "text-emerald-400" : "text-rose-400";
  if (m === "drawdown") return "text-rose-400";
  return "text-zinc-100";
}

function CrownIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 8l4.5 3 4.5-7 4.5 7L21 8l-1.8 11H4.8L3 8z" />
    </svg>
  );
}

function MedalIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 14a4 4 0 100-8 4 4 0 000 8zm-4 1.6L6.4 21l3.6-1.5L12 21l2-1.5 3.6 1.5L16 15.6A6 6 0 018 15.6z" />
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
      className={`inline-flex items-center gap-1 rounded ${info.bg} px-1.5 py-0.5 text-[10px] font-medium ${info.color} ring-1 ${info.ring}`}
    >
      <ShieldIcon className="size-3" />
      {tier}
    </span>
  );
}

function ChevronDown() {
  return (
    <svg className="size-3 text-zinc-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4.5l3 3 3-3" />
    </svg>
  );
}

function PodiumCard({
  rank,
  agent,
  metric,
  height,
  accent,
}: {
  rank: 1 | 2 | 3;
  agent: Agent;
  metric: Metric;
  height: string;
  accent: { ring: string; tint: string; chip: string };
}) {
  return (
    <Link
      href={`/agent/${agent.slug}`}
      className={`group relative flex ${height} flex-col items-center justify-end rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 transition hover:border-zinc-700 hover:bg-zinc-900`}
    >
      <span
        className={`absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full ${accent.chip} px-3 py-0.5 text-xs font-semibold`}
      >
        {rank === 1 ? <CrownIcon className="size-3.5" /> : <MedalIcon className="size-3.5" />}#{rank}
      </span>

      <div
        className={`flex size-16 items-center justify-center rounded-full bg-gradient-to-br ${agent.avatarFrom} ${agent.avatarTo} text-2xl font-semibold text-white ring-2 ${accent.ring}`}
      >
        {agent.initial}
      </div>

      <div className="mt-3 flex max-w-full items-center gap-1.5">
        <span className="truncate text-sm font-semibold text-zinc-100">{agent.name}</span>
        <TierBadge tier={agent.trustTier} />
      </div>
      <div className="text-xs text-zinc-500">
        by <span className="font-mono">{truncateAddress(agent.authorFull)}</span>
      </div>
      <div className="mt-1 text-[11px] text-zinc-500">{marketLabel(agent)}</div>

      <div className="mt-3 text-[11px] uppercase tracking-wider text-zinc-500">
        30D {METRICS.find((m) => m.key === metric)?.label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${metricColor(agent, metric)}`}>
        {formatMetric(agent, metric)}
      </div>

      <div className="mt-3 grid w-full grid-cols-3 gap-1 border-t border-zinc-800 pt-3 text-center text-[11px]">
        <div>
          <div className="text-zinc-500">Return</div>
          <div
            className={`tabular-nums ${
              agent.totalReturnBps >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {fmtPctSigned(bpsToPct(agent.totalReturnBps), 1)}
          </div>
        </div>
        <div>
          <div className="text-zinc-500">Win</div>
          <div className="tabular-nums text-zinc-200">
            {bpsToPct(agent.winRateBps).toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-zinc-500">Sharpe</div>
          <div className="tabular-nums text-zinc-200">{(agent.sharpeX1000 / 1000).toFixed(2)}</div>
        </div>
      </div>

      <span className={`absolute inset-x-0 bottom-0 h-1 rounded-b-2xl ${accent.tint}`} />
    </Link>
  );
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; tier?: string }>;
}) {
  const sp = await searchParams;
  const validMetrics = METRICS.map((m) => m.key);
  const metric: Metric = (validMetrics as string[]).includes(sp.metric ?? "")
    ? (sp.metric as Metric)
    : "totalReturn";

  const tierFilter: "all" | TrustTier = (["all", "T1", "T2", "T3"] as const).includes(
    (sp.tier ?? "all") as "all" | TrustTier
  )
    ? ((sp.tier ?? "all") as "all" | TrustTier)
    : "all";

  const filtered = agents.filter(
    (a) => tierFilter === "all" || a.trustTier === tierFilter
  );
  const ranked = [...filtered].sort(
    (a, b) => getMetricValue(b, metric) - getMetricValue(a, metric)
  );
  const [first, second, third] = ranked;

  const accents = {
    1: {
      ring: "ring-yellow-400",
      tint: "bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400",
      chip: "bg-yellow-400 text-zinc-900",
    },
    2: {
      ring: "ring-zinc-300",
      tint: "bg-gradient-to-r from-zinc-300 via-zinc-200 to-zinc-300",
      chip: "bg-zinc-300 text-zinc-900",
    },
    3: {
      ring: "ring-amber-700",
      tint: "bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700",
      chip: "bg-amber-700 text-zinc-50",
    },
  };

  const buildHref = (params: { metric?: Metric; tier?: "all" | TrustTier }) => {
    const m = params.metric ?? metric;
    const tr = params.tier ?? tierFilter;
    const qs = new URLSearchParams();
    if (m !== "totalReturn") qs.set("metric", m);
    if (tr !== "all") qs.set("tier", tr);
    const s = qs.toString();
    return s ? `/leaderboard?${s}` : "/leaderboard";
  };

  return (
    <div className="w-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Link href="/" className="hover:text-zinc-300">Agents</Link>
              <span>/</span>
              <span className="text-zinc-300">Leaderboard</span>
            </div>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
              <CrownIcon className="size-6 text-yellow-400" />
              Top Verified Agents
            </h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-500">
              Ranking AI trading agents by metrics committed on-chain. Each row is a `Certificate`
              tuple anchored to 0G Galileo testnet.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {TIER_FILTERS.map((f) => {
              const active = f.key === tierFilter;
              return (
                <Link
                  key={f.key}
                  href={buildHref({ tier: f.key })}
                  scroll={false}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                    active
                      ? "border-yellow-400 bg-yellow-400 text-zinc-900"
                      : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
                  }`}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">Sort by:</span>
          {METRICS.map((m) => {
            const active = m.key === metric;
            return (
              <Link
                key={m.key}
                href={buildHref({ metric: m.key })}
                scroll={false}
                title={m.desc}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-yellow-400 text-zinc-900"
                    : "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
                }`}
              >
                {m.label}
              </Link>
            );
          })}
        </div>

        {ranked.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-12 text-center">
            <p className="text-sm text-zinc-400">No agents match the current filter.</p>
          </div>
        ) : (
          <>
            {first && (
              <div className="mt-8 grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
                {second ? (
                  <PodiumCard rank={2} agent={second} metric={metric} height="h-[360px]" accent={accents[2]} />
                ) : (
                  <div className="hidden sm:block" />
                )}
                <PodiumCard rank={1} agent={first} metric={metric} height="h-[400px]" accent={accents[1]} />
                {third ? (
                  <PodiumCard rank={3} agent={third} metric={metric} height="h-[340px]" accent={accents[3]} />
                ) : (
                  <div className="hidden sm:block" />
                )}
              </div>
            )}

            <div className="mt-10">
              <h2 className="mb-3 text-sm font-semibold text-zinc-300">
                Full ranking
                {tierFilter !== "all" && (
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    (filtered to {tierFilter})
                  </span>
                )}
              </h2>
              <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-900/60 text-[11px] uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">#</th>
                        <th className="px-4 py-3 font-medium">Agent</th>
                        <th className="px-4 py-3 font-medium">Market</th>
                        <th className="px-4 py-3 font-medium">Tier</th>
                        {METRICS.map((m) => (
                          <th
                            key={m.key}
                            className={`px-4 py-3 text-right font-medium ${
                              m.key === metric ? "text-yellow-400" : ""
                            }`}
                          >
                            {m.label}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {ranked.map((a, idx) => {
                        const rank = idx + 1;
                        return (
                          <tr key={a.slug} className="transition hover:bg-zinc-900">
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                                  rank === 1
                                    ? "bg-yellow-400 text-zinc-900"
                                    : rank === 2
                                    ? "bg-zinc-300 text-zinc-900"
                                    : rank === 3
                                    ? "bg-amber-700 text-zinc-50"
                                    : "bg-zinc-800 text-zinc-400"
                                }`}
                              >
                                {rank}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${a.avatarFrom} ${a.avatarTo} text-sm font-semibold text-white`}
                                >
                                  {a.initial}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-zinc-100">{a.name}</div>
                                  <div className="text-[11px] text-zinc-500">
                                    <span className="font-mono">{truncateAddress(a.authorFull)}</span>
                                    <span className="mx-1.5">·</span>
                                    {a.strategyClass}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-zinc-300">{marketLabel(a)}</td>
                            <td className="px-4 py-3"><TierBadge tier={a.trustTier} /></td>
                            <td
                              className={`px-4 py-3 text-right tabular-nums ${
                                a.totalReturnBps >= 0 ? "text-emerald-400" : "text-rose-400"
                              } ${metric === "totalReturn" ? "font-semibold" : ""}`}
                            >
                              {fmtPctSigned(bpsToPct(a.totalReturnBps))}
                            </td>
                            <td
                              className={`px-4 py-3 text-right tabular-nums text-zinc-200 ${
                                metric === "sharpe" ? "font-semibold text-zinc-100" : ""
                              }`}
                            >
                              {(a.sharpeX1000 / 1000).toFixed(2)}
                            </td>
                            <td
                              className={`px-4 py-3 text-right tabular-nums text-zinc-200 ${
                                metric === "winRate" ? "font-semibold text-zinc-100" : ""
                              }`}
                            >
                              {fmtPctUnsigned(bpsToPct(a.winRateBps))}
                            </td>
                            <td
                              className={`px-4 py-3 text-right tabular-nums text-rose-400 ${
                                metric === "drawdown" ? "font-semibold" : ""
                              }`}
                            >
                              −{fmtPctUnsigned(bpsToPct(a.maxDrawdownBps))}
                            </td>
                            <td
                              className={`px-4 py-3 text-right tabular-nums text-zinc-200 ${
                                metric === "mints" ? "font-semibold text-zinc-100" : ""
                              }`}
                            >
                              {a.mints}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={`/agent/${a.slug}`}
                                className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:border-zinc-600 hover:text-zinc-100"
                              >
                                Inspect
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-zinc-500">
                Ranking diturunkan dari `AgentCertificate` events di 0G Galileo. T3 entries carry an
                attestationHash from 0G Compute (v0.2 preview).
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
