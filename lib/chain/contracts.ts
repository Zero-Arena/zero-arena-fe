// Contract addresses + ABIs for Galileo testnet.
//
// Addresses come from zero-arena-contracts/deployments/galileo-testnet.json
// (verified contracts published 2026-05-10). ABIs are the minimal surface
// the SDK actually calls — same shape as zero-arena-sdk/src/chain/abi.ts.
//
// When zero-arena-contracts publishes the @zero-arena/contracts npm package,
// swap these inline strings for the imported artifact. Until then this
// in-line copy is the single source of truth on the FE side.

import { parseAbi } from "viem";

export const CONTRACTS = {
  AgentCertificate: "0x21a5DEA59cfA07B261d389A9554477e137805c2f" as const,
  ZeroArenaINFT: "0x4Bd4d45f206861aa7cD4421785a316A1dD06036f" as const,
  ReencryptionOracle: "0x63909dA30b0d65ad72b32b3C8C82515f7BFA6Fd6" as const,
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
