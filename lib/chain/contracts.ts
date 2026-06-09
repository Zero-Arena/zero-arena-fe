// Contract addresses + ABIs for 0G Mainnet (v0.2).
//
// DEFAULTS match the production deployment so the dashboard works without
// any env var configuration. Override any of them at deploy time via
// NEXT_PUBLIC_* env vars when targeting a different deployment.

import { parseAbi } from "viem";

// Zero-address sentinel — short-circuits readers when an address is unset.
const NOT_DEPLOYED: `0x${string}` = "0x0000000000000000000000000000000000000000";

const DEFAULTS = {
  AgentCertificate:   "0x21a5DEA59cfA07B261d389A9554477e137805c2f",
  ZeroArenaINFT:      "0x6a04821A1C7412D09d7E8c938179C8cAA795B7BC",
  ReencryptionOracle: "0x5514892c89385c0788E223EBbA9d6D6c219836F3",
  LiveCertificate:    "0x3f703dc5d20AdAC3Eda08eD6dd180558EAE8003f",
  Season:             "0x440c4A3Cf3B97DA7616F7Da457cb1FEF0862a1Ad",
} as const;

export const CONTRACTS = {
  AgentCertificate:   (process.env.NEXT_PUBLIC_AGENT_CERTIFICATE_ADDRESS   ?? DEFAULTS.AgentCertificate)   as `0x${string}`,
  ZeroArenaINFT:      (process.env.NEXT_PUBLIC_ZERO_ARENA_INFT_ADDRESS     ?? DEFAULTS.ZeroArenaINFT)      as `0x${string}`,
  ReencryptionOracle: (process.env.NEXT_PUBLIC_REENCRYPTION_ORACLE_ADDRESS ?? DEFAULTS.ReencryptionOracle) as `0x${string}`,
  LiveCertificate:    (process.env.NEXT_PUBLIC_LIVE_CERTIFICATE_ADDRESS    ?? DEFAULTS.LiveCertificate)    as `0x${string}`,
  Season:             (process.env.NEXT_PUBLIC_SEASON_ADDRESS              ?? DEFAULTS.Season)             as `0x${string}`,
} as const;

// True iff an address points at a real deployed contract (not the zero placeholder).
export function isDeployed(addr: `0x${string}`): boolean {
  return addr.toLowerCase() !== NOT_DEPLOYED;
}

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
  "function transferNonce(uint256 tokenId) view returns (uint256)",
  "function nextTokenId() view returns (uint256)",
  "function oracleSigner() view returns (address)",
  // ERC-7857 — exact arg order unconfirmed; aligned with transfer-oracle
  // payload in INTEGRATION.md (sealedKeyHash, newMetadataHash, deadline,
  // oracle signature). Verify on contract source before mainnet use.
  "function transferWithProof(address from, address to, uint256 tokenId, bytes32 sealedKeyHash, bytes32 newMetadataHash, uint256 deadline, bytes signature)",
  "event AgentMinted(uint256 indexed tokenId, address indexed owner, uint256 indexed certificateId, bytes32 metadataHash, bytes32 storageRoot)",
]);

// ─── v0.3 paper-trading contracts (RFC-001) ──────────────────────────────

export const LIVE_CERTIFICATE_ABI = parseAbi([
  "struct LiveRun { bytes32 cumulativeHash; uint64 startedAt; uint64 lastUpdatedAt; uint64 epochCount; uint8 status; uint16 liveMaxDrawdownBps; uint16 liveWinRateBps; int128 liveTotalReturnBps; uint128 liveSharpeX1000; }",
  "function get(uint256 tokenId) view returns (LiveRun r)",
  "function isActive(uint256 tokenId) view returns (bool)",
  "function authorizedUpdaters(uint256 tokenId, address updater) view returns (bool)",
  "function authorizeUpdater(uint256 tokenId, address updater, bool allowed)",
  "event PaperRunStarted(uint256 indexed tokenId, address indexed owner, uint64 startedAt, bytes32 initialCumulativeHash)",
  "event EpochCommitted(uint256 indexed tokenId, uint64 indexed epochIndex, bytes32 cumulativeHash, bytes32 epochHash, int128 liveTotalReturnBps, uint128 liveSharpeX1000)",
  "event PaperRunStopped(uint256 indexed tokenId, uint8 status, uint64 stoppedAt)",
]);

export const SEASON_ABI = parseAbi([
  "struct SeasonSpec { bytes32 datasetSpec; uint64 initialBalance; uint16 feeBps; uint16 slippageBps; uint8 market; uint8 maxLeverage; uint64 startTime; uint64 endTime; uint256 prizePool; address creator; bool settled; }",
  "function seasons(uint256 id) view returns (bytes32 datasetSpec, uint64 initialBalance, uint16 feeBps, uint16 slippageBps, uint8 market, uint8 maxLeverage, uint64 startTime, uint64 endTime, uint256 prizePool, address creator, bool settled)",
  "function nextSeasonId() view returns (uint256)",
  "function participantCount(uint256 seasonId) view returns (uint256)",
  "function getParticipants(uint256 seasonId) view returns (uint256[])",
  "function enrolled(uint256 seasonId, uint256 tokenId) view returns (bool)",
  "function enroll(uint256 seasonId, uint256 tokenId)",
  "event SeasonCreated(uint256 indexed id, bytes32 indexed datasetSpec, uint64 startTime, uint64 endTime, uint256 prizePool)",
  "event Enrolled(uint256 indexed seasonId, uint256 indexed tokenId, address indexed owner)",
  "event Settled(uint256 indexed seasonId, uint256[] sortedWinners, uint256 paidOut)",
]);

/** Live-run status byte (0=active, 1=stopped, 2=liquidated) → typed string. */
export function statusFromByte(byte: number): "active" | "stopped" | "liquidated" {
  if (byte === 0) return "active";
  if (byte === 1) return "stopped";
  if (byte === 2) return "liquidated";
  throw new Error(`statusFromByte: unknown status byte ${byte}`);
}

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
