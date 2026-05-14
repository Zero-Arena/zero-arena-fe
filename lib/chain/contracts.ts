// Contract addresses + ABIs for Galileo testnet (v0.2, deployed 2026-05-14).
//
// Addresses come from zero-arena-contracts/deployments/galileo-testnet.json
// and can be overridden at deploy time via NEXT_PUBLIC_* env vars. ABIs are
// the minimal surface the FE reads.

import { parseAbi } from "viem";

const DEFAULTS = {
  AgentCertificate:   "0x77f29d2a7BcAC679812d9a0FB1c7508eDA6B087e",
  ZeroArenaINFT:      "0xF7162ecbdB11DE4704043D4aF93B4030AD61700e",
  ReencryptionOracle: "0x733667CEBB27e310a8fb60799Af73A8C1fe501b2",
} as const;

export const CONTRACTS = {
  AgentCertificate:   (process.env.NEXT_PUBLIC_AGENT_CERTIFICATE_ADDRESS   ?? DEFAULTS.AgentCertificate)   as `0x${string}`,
  ZeroArenaINFT:      (process.env.NEXT_PUBLIC_ZERO_ARENA_INFT_ADDRESS     ?? DEFAULTS.ZeroArenaINFT)      as `0x${string}`,
  ReencryptionOracle: (process.env.NEXT_PUBLIC_REENCRYPTION_ORACLE_ADDRESS ?? DEFAULTS.ReencryptionOracle) as `0x${string}`,
} as const;

// viem's `parseAbi` uses human-readable ABI per abitype — `tuple(...)` is not
// valid; the right format is just `(...)` for inline structs and `function …
// view returns (…)` (no `external` modifier).

export const AGENT_CERTIFICATE_ABI = parseAbi([
  "struct Certificate { bytes32 runHash; bytes32 storageRootHash; bytes32 datasetHash; bytes32 attestationHash; int128 totalReturnBps; uint128 sharpeX1000; address owner; uint48 createdAt; uint16 maxDrawdownBps; uint16 winRateBps; uint8 trustTier; uint8 market; }",
  "function get(uint256 certId) view returns (Certificate cert)",
  "function nextCertId() view returns (uint256)",
  "event CertificateSubmitted(uint256 indexed certId, address indexed owner, bytes32 indexed runHash, bytes32 storageRootHash, uint8 trustTier, uint8 market)",
]);

export const ZERO_ARENA_INFT_ABI = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function metadataHashes(uint256 tokenId) view returns (bytes32)",
  "function storageRoots(uint256 tokenId) view returns (bytes32)",
  "function certificateOf(uint256 tokenId) view returns (uint256)",
  "function nextTokenId() view returns (uint256)",
  "event AgentMinted(uint256 indexed tokenId, address indexed owner, uint256 indexed certificateId, bytes32 metadataHash, bytes32 storageRoot)",
]);

/** Trust-tier byte (1=T1, 2=T2, 3=T3) → typed string. */
export function tierFromByte(byte: number): "T1" | "T2" | "T3" {
  if (byte === 1) return "T1";
  if (byte === 2) return "T2";
  if (byte === 3) return "T3";
  throw new Error(`tierFromByte: unknown tier byte ${byte}`);
}

/** Market byte (0=spot, 1=perp) → typed string. */
export function marketFromByte(byte: number): "spot" | "perp" {
  return byte === 0 ? "spot" : "perp";
}
