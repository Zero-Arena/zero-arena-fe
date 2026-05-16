"use client";

// Mint / claim iNFT modal — recipient-side of the ERC-7857 transfer flow
// (INTEGRATION.md §4). Connected wallet plays the TO role.
//
// The seller-side work (ECIES re-encrypt of AES key, new metadata blob,
// hash computation) happens OFF-CHAIN via the SDK CLI — the FE cannot
// touch the seller's AES key without breaking the trust model. This modal
// orchestrates everything that *can* happen client-side: ephemeral keygen,
// inputs from the seller's response, oracle signature fetch, and the
// final transferWithProof tx.

import { useCallback, useState } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { isHex } from "viem";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { zerog } from "@/lib/chain/zerog";
import { CONTRACTS, ZERO_ARENA_INFT_ABI } from "@/lib/chain/contracts";
import {
  defaultDeadline,
  signTransferProof,
  TransferOracleError,
  type Address,
  type Bytes32,
} from "@/lib/be/transfer-oracle";
import CopyButton from "./CopyButton";

interface Props {
  open: boolean;
  onClose: () => void;
  /** iNFT token id being claimed. */
  tokenId: bigint;
  /** Current on-chain owner (from `ownerOf(tokenId)`). Used as `from` in the
   * transferWithProof call and shown so the user knows whom to contact. */
  currentOwner: Address;
  /** Optional display name for the agent (header copy). */
  agentName?: string;
}

interface EphemeralKey {
  privateKey: `0x${string}`;
  publicKey: `0x${string}`;
  address: Address;
}

type Stage = "intro" | "keypair" | "seller-response" | "submit";

export default function MintINftDialog({
  open,
  onClose,
  tokenId,
  currentOwner,
  agentName,
}: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { switchChain, isPending: switching } = useSwitchChain();

  const [stage, setStage] = useState<Stage>("intro");
  const [keypair, setKeypair] = useState<EphemeralKey | null>(null);

  // Form state for the seller's response.
  const [sealedKeyHash, setSealedKeyHash] = useState("");
  const [newMetadataHash, setNewMetadataHash] = useState("");
  const [deadlineSec, setDeadlineSec] = useState<string>(() =>
    defaultDeadline().toString(),
  );
  const [oracleSig, setOracleSig] = useState<`0x${string}` | null>(null);
  const [fetchingSig, setFetchingSig] = useState(false);
  const [oracleError, setOracleError] = useState<string | null>(null);

  const wrongNetwork = isConnected && chainId !== zerog.id;

  const {
    writeContractAsync,
    data: txHash,
    isPending: txPending,
  } = useWriteContract();
  const [txError, setTxError] = useState<string | null>(null);

  const generateKeypair = useCallback(() => {
    const pk = generatePrivateKey();
    const acct = privateKeyToAccount(pk);
    setKeypair({
      privateKey: pk,
      publicKey: acct.publicKey,
      address: acct.address,
    });
    setStage("keypair");
  }, []);

  const sealedHashValid = isHex(sealedKeyHash) && sealedKeyHash.length === 66;
  const metaHashValid = isHex(newMetadataHash) && newMetadataHash.length === 66;
  // Format-only check; freshness (deadline > now) is enforced at click time
  // to avoid impure Date.now() calls during render (react-hooks/purity).
  const deadlineFormatValid = /^\d+$/.test(deadlineSec);

  const canFetchSig =
    isConnected && !wrongNetwork && sealedHashValid && metaHashValid && deadlineFormatValid;

  const fetchSignature = useCallback(async () => {
    if (!address) return;
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const deadline = BigInt(deadlineSec);
    if (deadline <= nowSec) {
      setOracleError("deadline is in the past — set it to a future unix-seconds value");
      return;
    }
    setFetchingSig(true);
    setOracleError(null);
    setOracleSig(null);
    try {
      const { signature } = await signTransferProof({
        tokenId,
        from: currentOwner,
        to: address,
        sealedKeyHash: sealedKeyHash as Bytes32,
        newMetadataHash: newMetadataHash as Bytes32,
        deadline,
      });
      setOracleSig(signature);
      setStage("submit");
    } catch (e) {
      if (e instanceof TransferOracleError) {
        setOracleError(`${e.status}: ${e.message}`);
      } else {
        setOracleError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setFetchingSig(false);
    }
  }, [address, currentOwner, deadlineSec, newMetadataHash, sealedKeyHash, tokenId]);

  const submitTx = useCallback(async () => {
    if (!address || !oracleSig) return;
    setTxError(null);
    try {
      await writeContractAsync({
        address: CONTRACTS.ZeroArenaINFT,
        abi: ZERO_ARENA_INFT_ABI,
        functionName: "transferWithProof",
        args: [
          currentOwner,
          address,
          tokenId,
          sealedKeyHash as Bytes32,
          newMetadataHash as Bytes32,
          BigInt(deadlineSec),
          oracleSig,
        ],
      });
    } catch (e) {
      setTxError(e instanceof Error ? e.message : String(e));
    }
  }, [
    address,
    currentOwner,
    deadlineSec,
    newMetadataHash,
    oracleSig,
    sealedKeyHash,
    tokenId,
    writeContractAsync,
  ]);

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
              Claim iNFT {agentName ? `· ${agentName}` : `#${tokenId.toString()}`}
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              ERC-7857 re-encryption transfer · oracle-signed proof
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
          {!isConnected ? (
            <Section title="Connect your wallet">
              <p className="text-zinc-400">
                You&apos;ll receive the iNFT — connect the wallet that should own it.
              </p>
              <button
                onClick={openConnectModal}
                disabled={!openConnectModal}
                className="mt-3 rounded-md bg-green-400 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-green-300 disabled:opacity-60"
              >
                Connect Wallet
              </button>
            </Section>
          ) : wrongNetwork ? (
            <Section title="Switch to 0G Mainnet">
              <p className="text-zinc-400">
                The transfer happens on chain id {zerog.id}.
              </p>
              <button
                onClick={() => switchChain({ chainId: zerog.id })}
                disabled={switching}
                className="mt-3 rounded-md bg-green-400 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-green-300 disabled:opacity-60"
              >
                {switching ? "Switching…" : "Switch network"}
              </button>
            </Section>
          ) : (
            <>
              <StepHeader
                stage={stage}
                onSelect={(s) => {
                  if (s === "intro" || s === "keypair" || s === "seller-response" || s === "submit")
                    setStage(s);
                }}
              />

              {stage === "intro" && (
                <Section title="1 · Generate your receive key">
                  <p className="text-zinc-400">
                    A fresh secp256k1 keypair the seller will use to re-encrypt the
                    agent&apos;s AES key. The <strong>private key</strong> is your
                    only way to decrypt the metadata after transfer — save it
                    immediately.
                  </p>
                  <button
                    onClick={generateKeypair}
                    className="mt-3 rounded-md bg-green-400 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-green-300"
                  >
                    Generate keypair
                  </button>
                </Section>
              )}

              {stage === "keypair" && keypair && (
                <Section title="2 · Send your public key to the current owner">
                  <p className="text-zinc-400">
                    Owner runs the SDK CLI (<code className="font-mono text-[11px]">zeroarena transfer prepare</code>) with
                    this pubkey to produce the sealed key + new metadata hash.
                  </p>
                  <Field
                    label="Recipient public key (give this to seller)"
                    value={keypair.publicKey}
                  />
                  <Field
                    label="Recipient address"
                    value={keypair.address}
                    mono
                  />
                  <div className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/5 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-300">
                      Save your private key now
                    </div>
                    <p className="mt-1 text-[11px] text-rose-200/80">
                      Closing this dialog without saving will lose the only key
                      that can decrypt the agent metadata after transfer.
                    </p>
                    <Field
                      label=""
                      value={keypair.privateKey}
                      mono
                      danger
                    />
                  </div>
                  <button
                    onClick={() => setStage("seller-response")}
                    className="mt-4 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-600"
                  >
                    I&apos;ve saved it · next
                  </button>
                </Section>
              )}

              {stage === "seller-response" && (
                <Section title="3 · Paste the seller's response">
                  <p className="text-zinc-400">
                    Owner returns three values from the SDK output. Both hashes
                    must be 0x + 64 hex chars.
                  </p>
                  <TextField
                    label="sealedKeyHash"
                    placeholder="0x…"
                    value={sealedKeyHash}
                    onChange={setSealedKeyHash}
                    valid={!sealedKeyHash || sealedHashValid}
                    mono
                  />
                  <TextField
                    label="newMetadataHash"
                    placeholder="0x…"
                    value={newMetadataHash}
                    onChange={setNewMetadataHash}
                    valid={!newMetadataHash || metaHashValid}
                    mono
                  />
                  <TextField
                    label="deadline (unix seconds)"
                    placeholder="numeric, e.g. 1747500000"
                    value={deadlineSec}
                    onChange={setDeadlineSec}
                    valid={!deadlineSec || deadlineFormatValid}
                    mono
                  />

                  <div className="mt-2 grid grid-cols-2 gap-3 rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-[11px] text-zinc-400">
                    <KV k="from (owner)" v={currentOwner} />
                    <KV k="to (you)" v={address ?? "—"} />
                    <KV k="tokenId" v={tokenId.toString()} />
                    <KV k="chainId" v={zerog.id.toString()} />
                  </div>

                  {oracleError && (
                    <p className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                      Oracle: {oracleError}
                    </p>
                  )}

                  <button
                    onClick={fetchSignature}
                    disabled={!canFetchSig || fetchingSig}
                    className="mt-4 rounded-md bg-green-400 px-3 py-1.5 text-xs font-semibold text-zinc-900 transition hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {fetchingSig ? "Fetching signature…" : "Request oracle signature"}
                  </button>
                </Section>
              )}

              {stage === "submit" && oracleSig && (
                <Section title="4 · Submit transferWithProof">
                  <p className="text-zinc-400">
                    Oracle signature obtained. Submit the on-chain transfer to
                    receive token #{tokenId.toString()}.
                  </p>
                  <Field label="oracle signature" value={oracleSig} mono />

                  {txError && (
                    <p className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                      Tx: {txError}
                    </p>
                  )}
                  {txHash && (
                    <p className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
                      Submitted ·{" "}
                      <a
                        className="underline"
                        href={`${zerog.blockExplorers.default.url}/tx/${txHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {truncateHash(txHash)} ↗
                      </a>
                    </p>
                  )}

                  <button
                    onClick={submitTx}
                    disabled={txPending || !!txHash}
                    className="mt-4 rounded-md bg-green-400 px-3 py-1.5 text-xs font-semibold text-zinc-900 transition hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {txPending
                      ? "Confirm in wallet…"
                      : txHash
                        ? "Submitted"
                        : "Submit transfer tx"}
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

// ─── tiny presentational helpers ─────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">{title}</h3>
      <div className="mt-2 space-y-2 text-xs">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  mono,
  danger,
}: {
  label: string;
  value: string;
  mono?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="mt-2">
      {label && (
        <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      )}
      <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5">
        <span
          className={`flex-1 overflow-x-auto whitespace-nowrap text-[11px] ${
            mono ? "font-mono" : ""
          } ${danger ? "text-rose-200" : "text-zinc-200"}`}
        >
          {value}
        </span>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  valid,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  valid: boolean;
  mono?: boolean;
}) {
  return (
    <div className="mt-2">
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        placeholder={placeholder}
        spellCheck={false}
        className={`w-full rounded-md border bg-zinc-900/60 px-2.5 py-1.5 text-[11px] outline-none transition ${
          valid
            ? "border-zinc-800 focus:border-zinc-600"
            : "border-rose-500/60 focus:border-rose-400"
        } ${mono ? "font-mono" : ""} text-zinc-200 placeholder:text-zinc-600`}
      />
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</div>
      <div className="mt-0.5 truncate font-mono text-zinc-300" title={v}>
        {v}
      </div>
    </div>
  );
}

function StepHeader({
  stage,
  onSelect,
}: {
  stage: Stage;
  onSelect: (s: Stage) => void;
}) {
  const steps: { id: Stage; label: string }[] = [
    { id: "intro", label: "Intro" },
    { id: "keypair", label: "Keypair" },
    { id: "seller-response", label: "Seller resp." },
    { id: "submit", label: "Submit" },
  ];
  const activeIdx = steps.findIndex((s) => s.id === stage);
  return (
    <ol className="flex items-center gap-1 text-[10px]">
      {steps.map((s, i) => {
        const reached = i <= activeIdx;
        return (
          <li key={s.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => reached && onSelect(s.id)}
              className={`rounded-md px-2 py-0.5 transition ${
                i === activeIdx
                  ? "bg-green-400 text-zinc-900"
                  : reached
                    ? "border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                    : "border border-zinc-800 text-zinc-600"
              }`}
              disabled={!reached}
            >
              {i + 1}. {s.label}
            </button>
            {i < steps.length - 1 && <span className="text-zinc-700">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

function truncateHash(h: string) {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}
