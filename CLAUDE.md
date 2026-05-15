# CLAUDE.md — zero-arena-fe

FE-specific guidance for Claude Code sessions. Shared concepts (mission, trust model, repo split, addresses) live in the root [`CLAUDE.md`](../CLAUDE.md). This file only adds FE-specific rules.

## Scope

The dashboard does three things:

1. **Leaderboard** — every minted iNFT ranked by metric (totalReturn, Sharpe, winRate). Filters by market, trust tier, asset.
2. **Agent detail** — full on-chain metrics, trust-tier badge, dataset link, owner address, equity-curve chart, verifier flow.
3. **Verification panel** — every public artifact tied to the cert: cert tx, mint tx, storage roots. Never decrypts anything.

Out of scope for v0.2: wallet connect for writes, buying/selling, transfer initiation, edit-your-agent forms. Read-only.

## Stack

- Next.js 16 (Turbopack), React 19, app router
- Tailwind 4 (no separate config — `@tailwindcss/postcss`)
- viem 2 for server-side chain reads (`lib/chain/client.ts`)
- wagmi 3 + `@tanstack/react-query` for any client hook (wallet connect today; mint/clone in v0.3)
- `lightweight-charts` for equity series
- pnpm

## Data sources — single source of truth

The FE never queries the SDK or backend at runtime. It reads chain + storage directly.

| Source | What it gives | How to read it |
| - | - | - |
| `AgentCertificate` | runHash, dataset/storage hashes, metrics, owner, trustTier, market, attestationHash | `CertificateSubmitted` events + `get(certId)` |
| `ZeroArenaINFT` | tokenId, owner, certificateId, metadataHash, storageRoot | `AgentMinted` events + `ownerOf` / `metadataHashes` / `storageRoots` / `certificateOf` |
| `LiveCertificate` | live metrics, epoch count | `EpochCommitted` events + `get(tokenId)` |
| `Season` | season specs, participants, leaderboard hint | `SeasonCreated` events + `seasons(id)` + `getParticipants(id)` |
| `datasets.lock.json` (from zero-arena-bacend) | symbol/interval/source mapping per `datasetHash` | static fetch via raw GitHub or Vercel rewrite |

No off-chain indexer in v0.2 — direct RPC handles the event volume. If we outgrow this, add a Subgraph; contract interfaces don't change.

## Public vs private data

| Field | Public? | Source |
| - | - | - |
| `tokenId`, `certId`, `runHash`, `datasetHash`, `metadataHash`, `storageRoot`, `attestationHash` | ✅ | chain |
| Metrics (`totalReturnBps`, `sharpeX1000`, `maxDrawdownBps`, `winRateBps`) | ✅ | chain |
| `trustTier`, `market`, `owner`, `createdAt` | ✅ | chain |
| Encrypted run-log envelope | ✅ (the bytes are public) | 0G Storage |
| Decrypted run log (trades, equity curve) | 🔒 AES-256 | owner-only |
| Agent `name`, `description`, hyperparams | 🔒 AES-256 | owner-only |
| AES key | 🔒 | local at `~/.zeroarena/keys/agent-<tokenId>.key` |

The FE renders only the ✅ rows. Asking the user for a decryption key is **out of scope** — would break the trust story.

Placeholder display values (e.g. `Agent #${tokenId}`, deterministic sparkline derived from `runHash` bytes) fill UI fields where the chain doesn't carry display copy.

## When on-chain `name`/`description` becomes a requirement

If we need real strategy names before v0.4, do NOT ask owners for AES keys. Two correct architectural answers:

1. **Public profile registry** (post-v0.2) — small contract or off-chain DB keyed by owner address; owners opt-in to publish a public display name + bio. Encrypted strategy stays encrypted; only marketing copy is public.
2. **Public-metadata field at mint** — extend `ZeroArenaINFT.mint` to take optional `bytes publicMeta` of `(name, description)`. Backwards-compatible.

Never decrypt encrypted metadata blobs on the FE under any circumstances.

## Component contracts

| Hook / function | Responsibility |
| - | - |
| `useAgents()` | Paginates `AgentMinted` from `deployBlock`, joins with `AgentCertificate.get()`. Caches in localStorage with TTL. |
| `useAgent(tokenId)` | Single-token hydration with the same join. |
| `useDatasetMeta(datasetHash)` | Looks up symbol/interval/source from the static `datasets.lock.json` snapshot. |
| Trust-tier mappers | `1/2/3` → `'T1'/'T2'/'T3'` |
| Market mappers | `0/1` → `'spot'/'perp'` |
| Bps + ×1000 helpers | unit conversion (in `lib/agents.ts`) |

## Coupling rules

- **No `zeroarena` npm dep.** The SDK pulls in Node-only deps (`@0gfoundation/0g-storage-ts-sdk`, signer code) that bloat the browser. Use `ethers` (or `viem`/`wagmi`) directly.
- **Depend on `@zero-arena/contracts` for ABIs + addresses** (when that package ships). Until then, inline minimal ABI fragments in `lib/chain/contracts.ts`.
- **Mirror `CANONICAL_DATASETS` from SDK.** When the backend re-uploads a dataset, bump `lib/chain/datasets.ts` in lockstep. SDK's `datasets.ts` is source of truth.

## Build trip-wires

Things that silently break the FE if the contracts side changes — keep a CI smoke check in mind:

- Renaming an event or changing event arg order on any contract. **Locked at v0.2**; any redeploy that changes events bumps `@zero-arena/contracts` major.
- Reordering struct fields in `Certificate` or `Season`. Same rule.
- Changing bps / ×1000 scale on metrics. Locked at v0.2.
- Re-deploying contracts without bumping `@zero-arena/contracts` addresses. Solution: any redeploy republishes `@zero-arena/contracts`; FE runs `npm update` before next prod build.

## Deploy

Production: [zero-arena-fe.vercel.app](https://zero-arena-fe.vercel.app). Vercel auto-deploys on every push to `main` on the source repo wired to Vercel. Env vars are optional — `lib/chain/contracts.ts` ships hardcoded v0.2 Galileo addresses that match production. `NEXT_PUBLIC_*` overrides only when targeting a different deployment.

## v0.3 placeholders — operator badge on live cert

Every live cert card needs to badge its operator type (see root [`CLAUDE.md`](https://github.com/Zero-Arena/zero-arena/blob/main/CLAUDE.md) "Trust model — Arena layer"):

| Badge | Source of truth |
| - | - |
| `Owner-operated` | `LiveCertificate.authorizedUpdaters[tokenId][operator]` where `operator == iNFT.ownerOf(tokenId)` |
| `Operator: Zero Arena` | `authorizedUpdaters[tokenId][ZA_OPERATOR_ADDR]` true and a delegation record exists at the backend |
| `TEE-attested` (v0.4) | `LiveCertificate.get(tokenId).attestationHash != 0x0` |

For v0.2, default to `Owner-operated` for any token with active live cert. Reserve the badge component slot in the agent detail page now; wire to backend lookup once `/paper/onboard` ships.

## v0.4 placeholders

UI architecture should leave room for, but not yet implement:

- `T3` badge that becomes meaningful when `attestationHash != 0x0`.
- "Verify TEE quote" button that fetches the 0G Compute attestation report referenced by `attestationHash` and validates it client-side.
- Signed-receipt viewer for LLM-calling agents (TeeTLS provider fingerprint + request/response hashes).

None of these block v0.2.
