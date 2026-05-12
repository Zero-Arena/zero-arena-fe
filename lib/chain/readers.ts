// Server-side readers — turn Galileo on-chain state into the `Agent` shape the
// FE renders. Per CLAUDE.md 16 the FE is read-only; it never asks for keys
// and never decrypts the run log. Encrypted fields (agent name, description,
// trades) are surfaced as derived placeholders ("Agent #tokenId", etc).
//
// Cached at the Next.js fetch layer — the underlying RPC is the bottleneck,
// not the joins. Set `revalidate` on the calling server component to control
// freshness.

import { publicClient } from "./client";
import {
  AGENT_CERTIFICATE_ABI,
  CONTRACTS,
  ZERO_ARENA_INFT_ABI,
  marketFromByte,
  tierFromByte,
} from "./contracts";
import { DEPLOY_BLOCK } from "./galileo";

export interface OnChainCertificate {
  certId: bigint;
  runHash: `0x${string}`;
  storageRootHash: `0x${string}`;
  datasetHash: `0x${string}`;
  attestationHash: `0x${string}`;
  owner: `0x${string}`;
  createdAt: number;
  totalReturnBps: number;
  sharpeX1000: number;
  maxDrawdownBps: number;
  winRateBps: number;
  trustTier: "T1" | "T2" | "T3";
  market: "spot" | "perp";
}

export interface OnChainAgentMint {
  tokenId: bigint;
  owner: `0x${string}`;
  certificateId: bigint;
  metadataHash: `0x${string}`;
  storageRoot: `0x${string}`;
}

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Read every certificate the AgentCertificate contract has issued. Uses
 * `nextCertId` to bound the loop instead of scanning events — simpler, fewer
 * RPC roundtrips, and works even if the chain prunes old logs.
 */
export async function readCertificates(): Promise<OnChainCertificate[]> {
  const nextId = await publicClient.readContract({
    address: CONTRACTS.AgentCertificate,
    abi: AGENT_CERTIFICATE_ABI,
    functionName: "nextCertId",
  });

  if (nextId <= 1n) return [];

  // multicall: read every cert in one batched RPC roundtrip via viem's batch
  const calls = [];
  for (let id = 1n; id < nextId; id++) {
    calls.push({
      address: CONTRACTS.AgentCertificate,
      abi: AGENT_CERTIFICATE_ABI,
      functionName: "get" as const,
      args: [id] as const,
    });
  }

  const results = await Promise.all(
    calls.map((c) =>
      publicClient.readContract(c).catch((err: unknown) => {
        console.warn(`readCertificates: cert ${c.args[0]} failed`, err);
        return null;
      }),
    ),
  );

  const certs: OnChainCertificate[] = [];
  for (let i = 0; i < results.length; i++) {
    const cert = results[i];
    if (!cert) continue;
    // Skip the zero-cert sentinel (uninitialized slot defensive guard).
    if (cert.runHash === ZERO_BYTES32) continue;
    certs.push({
      certId: BigInt(i + 1),
      runHash: cert.runHash,
      storageRootHash: cert.storageRootHash,
      datasetHash: cert.datasetHash,
      attestationHash: cert.attestationHash,
      owner: cert.owner,
      createdAt: Number(cert.createdAt),
      totalReturnBps: Number(cert.totalReturnBps),
      sharpeX1000: Number(cert.sharpeX1000),
      maxDrawdownBps: Number(cert.maxDrawdownBps),
      winRateBps: Number(cert.winRateBps),
      trustTier: tierFromByte(cert.trustTier),
      market: marketFromByte(cert.market),
    });
  }
  return certs;
}

/**
 * Read every minted iNFT by scanning AgentMinted events from the deploy
 * block. Event volume on Galileo testnet is small (≪ 1k per day), so a
 * single getLogs call is fine for v0.1.
 */
export async function readAgentMints(): Promise<OnChainAgentMint[]> {
  const logs = await publicClient.getContractEvents({
    address: CONTRACTS.ZeroArenaINFT,
    abi: ZERO_ARENA_INFT_ABI,
    eventName: "AgentMinted",
    fromBlock: DEPLOY_BLOCK,
    toBlock: "latest",
  });

  const mints: OnChainAgentMint[] = [];
  for (const log of logs) {
    if (!log.args) continue;
    const { tokenId, owner, certificateId, metadataHash, storageRoot } = log.args;
    if (
      tokenId === undefined ||
      owner === undefined ||
      certificateId === undefined ||
      metadataHash === undefined ||
      storageRoot === undefined
    ) {
      continue;
    }
    mints.push({ tokenId, owner, certificateId, metadataHash, storageRoot });
  }
  return mints;
}
