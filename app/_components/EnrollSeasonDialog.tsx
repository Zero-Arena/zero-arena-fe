"use client";

// Enroll-an-agent modal for a season (INTEGRATION.md §2). Owner-signed
// on-chain write to Season.enroll(seasonId, tokenId) — no BE involved.
//
// Preflight reads (parallel via useReadContracts):
//   - iNFT.ownerOf(tokenId) must equal connected address
//   - Season.enrolled(seasonId, tokenId) must be false
// Time-window enforcement is left to the contract — if the season hasn't
// started or has ended, the tx reverts and we surface the error.

import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContracts,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { zerog } from "@/lib/chain/zerog";
import {
  CONTRACTS,
  SEASON_ABI,
  ZERO_ARENA_INFT_ABI,
} from "@/lib/chain/contracts";

interface Props {
  open: boolean;
  onClose: () => void;
  seasonId: bigint;
  /** Optional label used in the header (e.g. `Season #5`). */
  seasonLabel?: string;
}

export default function EnrollSeasonDialog({
  open,
  onClose,
  seasonId,
  seasonLabel,
}: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { switchChain, isPending: switching } = useSwitchChain();

  const [tokenIdStr, setTokenIdStr] = useState("");
  const tokenId = useMemo<bigint | null>(() => {
    if (!/^\d+$/.test(tokenIdStr)) return null;
    try {
      return BigInt(tokenIdStr);
    } catch {
      return null;
    }
  }, [tokenIdStr]);

  const wrongNetwork = isConnected && chainId !== zerog.id;
  const canQuery = !!tokenId && isConnected && !wrongNetwork;

  // Parallel preflight reads — auto-fire whenever tokenId becomes a valid bigint.
  const {
    data: preflight,
    isFetching: preflightFetching,
    refetch: refetchPreflight,
  } = useReadContracts({
    contracts: tokenId
      ? [
          {
            address: CONTRACTS.ZeroArenaINFT,
            abi: ZERO_ARENA_INFT_ABI,
            functionName: "ownerOf",
            args: [tokenId],
          } as const,
          {
            address: CONTRACTS.Season,
            abi: SEASON_ABI,
            functionName: "enrolled",
            args: [seasonId, tokenId],
          } as const,
        ]
      : [],
    query: { enabled: canQuery },
  });

  const ownerOnChain = preflight?.[0]?.result as `0x${string}` | undefined;
  const ownerCheckErr = preflight?.[0]?.error;
  const alreadyEnrolled = preflight?.[1]?.result as boolean | undefined;

  const isOwner =
    !!ownerOnChain && !!address && ownerOnChain.toLowerCase() === address.toLowerCase();

  const checksReady = !!preflight && !preflightFetching;
  const canSubmit =
    checksReady && isOwner && alreadyEnrolled === false;

  const {
    writeContractAsync,
    data: txHash,
    isPending: txPending,
  } = useWriteContract();
  const [txError, setTxError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!tokenId) return;
    setTxError(null);
    try {
      await writeContractAsync({
        address: CONTRACTS.Season,
        abi: SEASON_ABI,
        functionName: "enroll",
        args: [seasonId, tokenId],
      });
    } catch (e) {
      setTxError(e instanceof Error ? e.message : String(e));
    }
  }, [seasonId, tokenId, writeContractAsync]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              Enroll an agent · {seasonLabel ?? `Season #${seasonId.toString()}`}
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Owner-signed on-chain tx · you pay gas
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

        <div className="space-y-4 px-6 py-5 text-sm text-zinc-200">
          {!isConnected ? (
            <div>
              <p className="text-zinc-400">Connect the wallet that owns the iNFT.</p>
              <button
                onClick={openConnectModal}
                disabled={!openConnectModal}
                className="mt-3 rounded-md bg-green-400 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-green-300 disabled:opacity-60"
              >
                Connect Wallet
              </button>
            </div>
          ) : wrongNetwork ? (
            <div>
              <p className="text-zinc-400">Switch to 0G Mainnet (chain id {zerog.id}).</p>
              <button
                onClick={() => switchChain({ chainId: zerog.id })}
                disabled={switching}
                className="mt-3 rounded-md bg-green-400 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-green-300 disabled:opacity-60"
              >
                {switching ? "Switching…" : "Switch network"}
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">
                  iNFT tokenId
                </label>
                <input
                  value={tokenIdStr}
                  onChange={(e) => setTokenIdStr(e.target.value.trim())}
                  placeholder="e.g. 12"
                  inputMode="numeric"
                  className={`w-full rounded-md border bg-zinc-900/60 px-2.5 py-1.5 font-mono text-[12px] outline-none transition ${
                    !tokenIdStr || tokenId !== null
                      ? "border-zinc-800 focus:border-zinc-600"
                      : "border-rose-500/60 focus:border-rose-400"
                  } text-zinc-200 placeholder:text-zinc-600`}
                />
              </div>

              {tokenId && (
                <div className="space-y-1.5 rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-[11px]">
                  <PreflightRow
                    label={`ownerOf(${tokenId.toString()}) is you`}
                    state={
                      !checksReady
                        ? "pending"
                        : ownerCheckErr
                          ? "fail"
                          : isOwner
                            ? "ok"
                            : "fail"
                    }
                    detail={
                      ownerCheckErr
                        ? "read failed — token may not exist"
                        : ownerOnChain
                          ? `on-chain owner: ${truncate(ownerOnChain)}`
                          : undefined
                    }
                  />
                  <PreflightRow
                    label="not already enrolled"
                    state={
                      !checksReady
                        ? "pending"
                        : alreadyEnrolled === undefined
                          ? "fail"
                          : alreadyEnrolled
                            ? "fail"
                            : "ok"
                    }
                    detail={alreadyEnrolled ? "this token is already enrolled" : undefined}
                  />
                </div>
              )}

              {txError && (
                <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                  Tx: {txError}
                </p>
              )}
              {txHash && (
                <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
                  Submitted ·{" "}
                  <a
                    className="underline"
                    href={`${zerog.blockExplorers.default.url}/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {truncate(txHash)} ↗
                  </a>
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={submit}
                  disabled={!canSubmit || txPending || !!txHash}
                  className="rounded-md bg-green-400 px-3 py-1.5 text-xs font-semibold text-zinc-900 transition hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {txPending
                    ? "Confirm in wallet…"
                    : txHash
                      ? "Submitted"
                      : "Enroll"}
                </button>
                {tokenId && (
                  <button
                    onClick={() => refetchPreflight()}
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-600"
                  >
                    Re-check
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PreflightRow({
  label,
  state,
  detail,
}: {
  label: string;
  state: "pending" | "ok" | "fail";
  detail?: string;
}) {
  const icon =
    state === "ok" ? (
      <span className="text-emerald-400">✓</span>
    ) : state === "fail" ? (
      <span className="text-rose-400">✗</span>
    ) : (
      <span className="text-zinc-500">…</span>
    );
  return (
    <div className="flex items-start gap-2">
      <span className="mt-px w-3 text-center">{icon}</span>
      <div className="flex-1">
        <div className="text-zinc-200">{label}</div>
        {detail && <div className="mt-0.5 font-mono text-[10px] text-zinc-500">{detail}</div>}
      </div>
    </div>
  );
}

function truncate(s: string): string {
  return `${s.slice(0, 8)}…${s.slice(-6)}`;
}
