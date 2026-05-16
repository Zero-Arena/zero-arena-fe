"use client";

// Delegate an agent to the Zero Arena hosted operator (INTEGRATION.md §3).
//
// The flow has three on-chain/off-chain steps the FE must coordinate:
//   1. GET /health  → learn the operator address + pubkey
//   2. On-chain check: LiveCertificate.authorizedUpdaters[tokenId][operator]
//      • if false: owner signs LiveCertificate.authorizeUpdater(...) tx
//   3. Owner signs an EIP-191 payload, FE POSTs /onboard with agent source
//
// After success, the operator badge on the live cert flips from
// `Owner-operated` to `Operator: Zero Arena` (badge derivation already
// reads authorizedUpdaters chain-side).

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSignMessage,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { zerog } from "@/lib/chain/zerog";
import { CONTRACTS, LIVE_CERTIFICATE_ABI } from "@/lib/chain/contracts";
import {
  fetchOnboardHealth,
  fetchOnboardStatus,
  isOnboardConfigured,
  newPayload,
  OnboardError,
  OnboardNotConfiguredError,
  payloadToSigningString,
  postOffboard,
  postOnboard,
  type Address,
  type Hex,
  type OffboardResponse,
  type OnboardHealth,
  type OnboardResponse,
  type OnboardStatus,
} from "@/lib/be/onboard";

interface Props {
  open: boolean;
  onClose: () => void;
  tokenId: bigint;
  /** Current iNFT owner (from server-side ownerOf read). Used to gate the
   * "you must be owner" check before reaching the contract. */
  currentOwner: Address;
  /** AgentCertificate.runHash for this iNFT — required by /onboard. */
  genesisHash: Hex;
  /** Default symbol/interval/market hints (from agent metadata). */
  defaultSymbol?: string;
  defaultInterval?: string;
  defaultMarket?: "spot" | "perp";
  agentName?: string;
}

export default function DelegateAgentDialog({
  open,
  onClose,
  tokenId,
  currentOwner,
  genesisHash,
  defaultSymbol = "btcusdt",
  defaultInterval = "15m",
  defaultMarket = "spot",
  agentName,
}: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { switchChain, isPending: switching } = useSwitchChain();

  const configured = isOnboardConfigured();
  const wrongNetwork = isConnected && chainId !== zerog.id;
  const isOwner =
    !!address && address.toLowerCase() === currentOwner.toLowerCase();

  // ─── 1) /health → operator (declarative via TanStack Query) ───────────
  const {
    data: health,
    error: healthError,
    isFetching: healthLoading,
    refetch: loadHealth,
  } = useQuery<OnboardHealth, Error>({
    queryKey: ["onboard-health"],
    queryFn: ({ signal }) => fetchOnboardHealth(signal),
    enabled: open && configured,
    retry: false,
    staleTime: 60_000,
  });

  const healthErr = healthError
    ? healthError instanceof OnboardError
      ? `${healthError.status}: ${healthError.message}`
      : healthError instanceof OnboardNotConfiguredError
        ? healthError.message
        : healthError.message
    : null;

  // ─── 1b) /status → is this tokenId already delegated? ─────────────────
  const {
    data: status,
    refetch: refetchStatus,
  } = useQuery<OnboardStatus, Error>({
    queryKey: ["onboard-status"],
    queryFn: ({ signal }) => fetchOnboardStatus({ signal }),
    enabled: open && configured && !!health,
    retry: false,
    staleTime: 15_000,
  });

  const currentDaemon = status?.daemons.find(
    (d) => d.tokenId === tokenId.toString(),
  );

  // ─── 2) authorizedUpdaters check + write ──────────────────────────────
  const { data: isAuthorized, refetch: refetchAuth } = useReadContract({
    address: CONTRACTS.LiveCertificate,
    abi: LIVE_CERTIFICATE_ABI,
    functionName: "authorizedUpdaters",
    args: health ? [tokenId, health.operator] : undefined,
    query: { enabled: !!health && isConnected && !wrongNetwork },
  });

  const {
    writeContractAsync: writeAuthorizeUpdater,
    data: authTxHash,
    isPending: authTxPending,
  } = useWriteContract();
  const [authTxErr, setAuthTxErr] = useState<string | null>(null);

  const authorize = useCallback(async () => {
    if (!health) return;
    setAuthTxErr(null);
    try {
      await writeAuthorizeUpdater({
        address: CONTRACTS.LiveCertificate,
        abi: LIVE_CERTIFICATE_ABI,
        functionName: "authorizeUpdater",
        args: [tokenId, health.operator, true],
      });
      // Pessimistic refresh — wagmi auto-watches blocks but a manual
      // refetch after the tx submits gives faster feedback.
      setTimeout(() => refetchAuth(), 3000);
    } catch (e) {
      setAuthTxErr(e instanceof Error ? e.message : String(e));
    }
  }, [health, refetchAuth, tokenId, writeAuthorizeUpdater]);

  // ─── 3) onboard inputs + submit ───────────────────────────────────────
  const [agentSource, setAgentSource] = useState("");
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [interval, setInterval] = useState(defaultInterval);
  const [market, setMarket] = useState<"spot" | "perp">(defaultMarket);

  const { signMessageAsync, isPending: signing } = useSignMessage();
  const [submitting, setSubmitting] = useState(false);
  const [onboardErr, setOnboardErr] = useState<string | null>(null);
  const [onboardResult, setOnboardResult] = useState<OnboardResponse | null>(null);

  const canSubmit =
    !!address &&
    !!health &&
    isAuthorized === true &&
    agentSource.trim().length > 0;

  const submitOnboard = useCallback(async () => {
    if (!address || !health) return;
    setOnboardErr(null);
    setOnboardResult(null);
    setSubmitting(true);
    try {
      const payload = newPayload("onboard", tokenId);
      const signature = (await signMessageAsync({
        message: payloadToSigningString(payload),
      })) as Hex;

      const res = await postOnboard({
        payload,
        signature,
        agentSource: agentSource.trim(),
        genesisHash,
        symbol,
        interval,
        market,
      });
      setOnboardResult(res);
      refetchStatus();
    } catch (e) {
      if (e instanceof OnboardError) setOnboardErr(`${e.status}: ${e.message}`);
      else if (e instanceof OnboardNotConfiguredError) setOnboardErr(e.message);
      else setOnboardErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [address, agentSource, genesisHash, health, interval, market, refetchStatus, signMessageAsync, symbol, tokenId]);

  // ─── 4) offboard ──────────────────────────────────────────────────────
  const [offboardErr, setOffboardErr] = useState<string | null>(null);
  const [offboardResult, setOffboardResult] = useState<OffboardResponse | null>(null);
  const [offboarding, setOffboarding] = useState(false);

  const submitOffboard = useCallback(async () => {
    if (!address || !health) return;
    setOffboardErr(null);
    setOffboardResult(null);
    setOffboarding(true);
    try {
      const payload = newPayload("offboard", tokenId);
      const signature = (await signMessageAsync({
        message: payloadToSigningString(payload),
      })) as Hex;

      const res = await postOffboard({ payload, signature });
      setOffboardResult(res);
      refetchStatus();
    } catch (e) {
      if (e instanceof OnboardError) setOffboardErr(`${e.status}: ${e.message}`);
      else if (e instanceof OnboardNotConfiguredError) setOffboardErr(e.message);
      else setOffboardErr(e instanceof Error ? e.message : String(e));
    } finally {
      setOffboarding(false);
    }
  }, [address, health, refetchStatus, signMessageAsync, tokenId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              Delegate to Zero Arena {agentName ? `· ${agentName}` : `#${tokenId.toString()}`}
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Hosted paper-trading daemon · v0.3 operator delegation
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            aria-label="Close"
          >
            <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>

        <div className="space-y-5 px-6 py-5 text-sm text-zinc-200">
          {!configured ? (
            <NotConfigured />
          ) : !isConnected ? (
            <SimplePrompt
              text="Connect the wallet that owns this iNFT."
              button="Connect Wallet"
              busy={!openConnectModal}
              onClick={() => openConnectModal?.()}
            />
          ) : wrongNetwork ? (
            <SimplePrompt
              text={`Switch to 0G Mainnet (chain id ${zerog.id}).`}
              button="Switch network"
              busy={switching}
              onClick={() => switchChain({ chainId: zerog.id })}
            />
          ) : !isOwner ? (
            <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
              Only the iNFT owner can delegate. Current owner:{" "}
              <span className="font-mono">{currentOwner}</span>
            </p>
          ) : (
            <>
              <Section title="1 · Operator">
                {healthLoading ? (
                  <p className="text-[11px] text-zinc-500">Loading /health…</p>
                ) : healthErr ? (
                  <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                    {healthErr}
                  </div>
                ) : health ? (
                  <div className="space-y-1 rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-[11px]">
                    <KV k="operator" v={health.operator} mono />
                    <KV k="scheme" v={health.encryptionScheme} />
                    <KV
                      k="active"
                      v={health.active ? "yes" : "no"}
                      tone={health.active ? "ok" : "warn"}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => loadHealth()}
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-600"
                  >
                    Fetch /health
                  </button>
                )}
              </Section>

              {health && currentDaemon && (
                <Section title="Delegation active">
                  <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-[11px]">
                    <div className="flex items-center gap-2 text-emerald-300">
                      <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                      Operator daemon running
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-zinc-400">
                      <KV k="pid" v={currentDaemon.pid.toString()} />
                      <KV k="startedAt" v={currentDaemon.startedAt} />
                    </div>
                  </div>

                  {offboardErr && (
                    <p className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                      Offboard: {offboardErr}
                    </p>
                  )}
                  {offboardResult && (
                    <p className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
                      {offboardResult.status === "offboarded"
                        ? `Stopped daemon for tokenId ${offboardResult.tokenId}.`
                        : `No active daemon found for tokenId ${offboardResult.tokenId}.`}
                    </p>
                  )}

                  <p className="mt-3 text-[11px] text-zinc-400">
                    Stopping signs an EIP-191 offboard payload and POSTs{" "}
                    <code className="font-mono text-zinc-300">/offboard</code>. On-chain{" "}
                    <code className="font-mono text-zinc-300">authorizedUpdaters</code>{" "}
                    is left intact — to fully revoke, also call{" "}
                    <code className="font-mono text-zinc-300">authorizeUpdater(…, false)</code>.
                  </p>
                  <button
                    onClick={submitOffboard}
                    disabled={offboarding || signing}
                    className="mt-3 rounded-md bg-rose-500 px-3 py-1.5 text-xs font-semibold text-zinc-50 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {signing
                      ? "Sign in wallet…"
                      : offboarding
                        ? "Posting /offboard…"
                        : "Stop delegation"}
                  </button>
                </Section>
              )}

              {health && !currentDaemon && (
                <Section title="2 · Authorize operator (on-chain)">
                  <p className="text-[11px] text-zinc-400">
                    Required before /onboard. One-time write to{" "}
                    <code className="font-mono text-zinc-300">authorizeUpdater(tokenId, operator, true)</code>.
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <StatusBadge
                      state={
                        isAuthorized === undefined
                          ? "pending"
                          : isAuthorized
                            ? "ok"
                            : "fail"
                      }
                      label={
                        isAuthorized === undefined
                          ? "checking…"
                          : isAuthorized
                            ? "authorized"
                            : "not authorized"
                      }
                    />
                    {isAuthorized === false && (
                      <button
                        onClick={authorize}
                        disabled={authTxPending}
                        className="rounded-md bg-green-400 px-3 py-1 text-xs font-semibold text-zinc-900 hover:bg-green-300 disabled:opacity-60"
                      >
                        {authTxPending ? "Confirm in wallet…" : "Authorize operator"}
                      </button>
                    )}
                  </div>
                  {authTxErr && (
                    <p className="mt-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                      Tx: {authTxErr}
                    </p>
                  )}
                  {authTxHash && (
                    <p className="mt-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
                      Auth tx ·{" "}
                      <a
                        className="underline"
                        href={`${zerog.blockExplorers.default.url}/tx/${authTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {truncate(authTxHash)} ↗
                      </a>
                    </p>
                  )}
                </Section>
              )}

              {health && isAuthorized && !currentDaemon && (
                <Section title="3 · Agent source + run config">
                  <p className="text-[11px] text-zinc-400">
                    Plaintext mode (dev). Production should ECIES-encrypt the
                    bundle to{" "}
                    <code className="font-mono text-zinc-300">operatorPubKey</code>; that path
                    isn&apos;t wired in v0.3.
                  </p>
                  <label className="mt-2 block text-[10px] uppercase tracking-wide text-zinc-500">
                    agentSource (JS module)
                  </label>
                  <textarea
                    value={agentSource}
                    onChange={(e) => setAgentSource(e.target.value)}
                    placeholder="export function decide(ctx) { return { signal: 'hold' }; }"
                    rows={6}
                    spellCheck={false}
                    className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                  />
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <SmallField label="symbol" value={symbol} onChange={setSymbol} />
                    <SmallField label="interval" value={interval} onChange={setInterval} />
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">
                        market
                      </label>
                      <select
                        value={market}
                        onChange={(e) => setMarket(e.target.value as "spot" | "perp")}
                        className="w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-zinc-600"
                      >
                        <option value="spot">spot</option>
                        <option value="perp">perp</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-[11px]">
                    <KV k="genesisHash" v={genesisHash} mono />
                    <KV k="tokenId" v={tokenId.toString()} />
                  </div>
                </Section>
              )}

              {health && isAuthorized && !currentDaemon && (
                <Section title="4 · Sign & submit">
                  {onboardErr && (
                    <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                      Onboard: {onboardErr}
                    </p>
                  )}
                  {onboardResult && (
                    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
                      <div>Daemon started · pid {onboardResult.pid}</div>
                      <div className="mt-0.5 text-emerald-400/70">
                        startedAt {onboardResult.startedAt}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={submitOnboard}
                    disabled={!canSubmit || submitting || signing || !!onboardResult}
                    className="mt-2 rounded-md bg-green-400 px-3 py-1.5 text-xs font-semibold text-zinc-900 transition hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {signing
                      ? "Sign in wallet…"
                      : submitting
                        ? "Posting /onboard…"
                        : onboardResult
                          ? "Delegated"
                          : "Sign & onboard"}
                  </button>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── presentational helpers ──────────────────────────────────────────────

function NotConfigured() {
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-[12px] text-amber-200">
      <div className="font-semibold">Onboard service not configured</div>
      <p className="mt-1 text-[11px] text-amber-200/80">
        Set <code className="font-mono">NEXT_PUBLIC_ONBOARD_URL</code> in{" "}
        <code className="font-mono">.env.local</code> once the Railway service ships
        (per INTEGRATION.md §3 — URL TBD). Restart the dev server after editing.
      </p>
    </div>
  );
}

function SimplePrompt({
  text,
  button,
  busy,
  onClick,
}: {
  text: string;
  button: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <div>
      <p className="text-zinc-400">{text}</p>
      <button
        onClick={onClick}
        disabled={busy}
        className="mt-3 rounded-md bg-green-400 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-green-300 disabled:opacity-60"
      >
        {busy ? "Working…" : button}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function KV({
  k,
  v,
  mono,
  tone,
}: {
  k: string;
  v: string;
  mono?: boolean;
  tone?: "ok" | "warn";
}) {
  const toneClass =
    tone === "ok" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-zinc-200";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</span>
      <span className={`${mono ? "font-mono" : ""} truncate ${toneClass}`} title={v}>
        {v}
      </span>
    </div>
  );
}

function StatusBadge({
  state,
  label,
}: {
  state: "pending" | "ok" | "fail";
  label: string;
}) {
  const cls =
    state === "ok"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : state === "fail"
        ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
        : "border-zinc-700 bg-zinc-900 text-zinc-400";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] ${cls}`}>
      {label}
    </span>
  );
}

function SmallField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 outline-none focus:border-zinc-600"
      />
    </div>
  );
}

function truncate(s: string): string {
  return `${s.slice(0, 10)}…${s.slice(-6)}`;
}
