// Typed client for the transfer-oracle BE service (INTEGRATION.md §4).
//
// The oracle signs ERC-7857 re-encryption proofs so the new owner can call
// ZeroArenaINFT.transferWithProof(...). It does NOT do any encryption or
// hash computation — those are the seller's responsibility (off-chain,
// CLI/SDK). The FE only orchestrates: collect inputs, fetch sig, submit tx.

import { CONTRACTS } from "@/lib/chain/contracts";
import { zerog } from "@/lib/chain/zerog";

const BASE_URL =
  process.env.NEXT_PUBLIC_TRANSFER_ORACLE_URL ??
  "https://transfer-oracle-production-f390.up.railway.app";

export type Bytes32 = `0x${string}`;
export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export interface OracleHealth {
  status: "ok";
  signer: Address;
}

export interface SignTransferProofRequest {
  tokenId: bigint;
  from: Address;
  to: Address;
  sealedKeyHash: Bytes32;
  newMetadataHash: Bytes32;
  /** Unix seconds. Defaults to now + 5 min when omitted at call site. */
  deadline: bigint;
}

export interface SignTransferProofResponse {
  signature: Hex;
}

export class TransferOracleError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "TransferOracleError";
  }
}

/** Health probe. Use the returned `signer` to verify against on-chain
 * `ZeroArenaINFT.oracleSigner()` before trusting a signature. */
export async function fetchOracleHealth(signal?: AbortSignal): Promise<OracleHealth> {
  const res = await fetch(`${BASE_URL}/health`, { signal });
  const body = await safeJson(res);
  if (!res.ok) throw new TransferOracleError("oracle /health failed", res.status, body);
  return body as OracleHealth;
}

/** Request a transferWithProof signature. All uint256s are wire-serialized
 * as decimal strings per the BE contract. */
export async function signTransferProof(
  req: SignTransferProofRequest,
  opts?: { bearerToken?: string; signal?: AbortSignal },
): Promise<SignTransferProofResponse> {
  const body = {
    chainId: zerog.id.toString(),
    inftAddress: CONTRACTS.ZeroArenaINFT,
    tokenId: req.tokenId.toString(),
    from: req.from,
    to: req.to,
    sealedKeyHash: req.sealedKeyHash,
    newMetadataHash: req.newMetadataHash,
    deadline: req.deadline.toString(),
  };

  const res = await fetch(`${BASE_URL}/sign-transfer-proof`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts?.bearerToken ? { authorization: `Bearer ${opts.bearerToken}` } : {}),
    },
    body: JSON.stringify(body),
    signal: opts?.signal,
  });

  const parsed = await safeJson(res);
  if (!res.ok) {
    const msg =
      (parsed as { error?: string })?.error ?? `oracle /sign-transfer-proof ${res.status}`;
    throw new TransferOracleError(msg, res.status, parsed);
  }
  return parsed as SignTransferProofResponse;
}

/** Default deadline: 5 minutes from now (matches INTEGRATION.md guidance). */
export function defaultDeadline(secondsAhead = 300): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + secondsAhead);
}

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}
