# CLAUDE.md — Zero Arena Build Spec

This document is the build spec for the Zero Arena project, organized as a multi-repo under the [`Zero-Arena`](https://github.com/Zero-Arena) GitHub organization. It is the source of truth during the 0G APAC Hackathon 2026 sprint (deadline: May 16, 2026, Track 2: Agentic Trading Arena). Public-facing copy lives in each repo's `README.md`; this file is internal.

---

## 1. Mission

Zero Arena is **verifiable performance infrastructure** for AI trading agents.

The problem: anyone can claim "my agent gets 70% winrate, 3x ROI." Today there is no way for a third party to verify that claim without either (a) trusting the claimant, or (b) demanding the agent's source code, which destroys the IP. This trust gap is what stops AI trading agents from becoming a real, ownable asset class.

Zero Arena closes the gap with four primitives, packaged as a single npm install:

1. **Run a deterministic OHLCV backtest** of a TypeScript trading agent. Agent code stays on the user's machine; nothing proprietary leaves in plaintext.
2. **Encrypt the run log** (inputs + agent decisions + executed trades) with AES-256 and upload to 0G Storage.
3. **Anchor a `Certificate`** on 0G Chain — `runHash`, storage root, dataset root, and the headline metrics (return, Sharpe, drawdown, winrate). Strategy stays sealed.
4. **Mint the agent as an ERC-7857 iNFT**. Transfers go through the oracle re-encryption flow so a new owner can run the agent without ever seeing the source.

**Zero Arena is model-agnostic infrastructure.** We do not host, run, endorse, or depend on any specific LLM or trading model. The agent's `decide()` function — whether it's an RSI rule, a Claude API call, a self-hosted Llama, a custom RL policy, or anything else — is entirely the developer's choice. Our scope ends at proving that whatever they wrote actually produced the trades they claim, on the dataset they claim. The model itself is none of our business.

Anything outside this list is out of scope for v0.1. No live trading, no 0G Compute integration in v0.1, no DA, no React dashboard, no Python, no first-party model offering ever.

---

## 2. MVP data scope

V0.1 ships with a single, narrow data domain so the demo, the determinism tests, and the deployed contracts all reference one shared root. **No live data feeds.** Everything is precomputed, hashed, and uploaded to 0G Storage once.

| Asset | Market | Source | Granularity | Window | Priority |
| - | - | - | - | - | - |
| BTC/USDT | Spot | Binance | 1h candles | last 365 days | P0 |
| 0G/USDT | Spot | Binance (or DEX fallback) | 1h candles | from listing date | P0 |
| BTC/USDT | Perpetual futures | Binance Futures (USDM) | 1h candles + 8h funding | last 365 days | P1 |
| 0G/USDT | Perpetual futures | Binance Futures if listed | 1h candles + 8h funding | from listing date | P2 (stretch) |

Ingestion runs once via a Node script in `zero-arena-example-agent/00-binance-ingest`, which:

1. Fetches each series from Binance public REST (`/api/v3/klines` for spot, `/fapi/v1/klines` + `/fapi/v1/fundingRate` for perps).
2. Normalizes into the canonical CSV schema (columns: `timestamp,open,high,low,close,volume,fundingRate?`).
3. Computes `datasetHash = keccak256(canonicalBytes(csv))`.
4. Uploads to 0G Storage and records the storage root.
5. Writes `examples/data/datasets.lock.json` so every backtest across machines anchors to the same bytes.

Spot vs. perp math:

- **Spot** uses the existing portfolio model: long-only, no leverage, no funding accrual.
- **Perpetual futures** adds: configurable leverage (default 3x, capped at 10x in v0.1), funding-rate accrual at every 8h boundary, simple **isolated-margin** liquidation when equity ≤ maintenance margin (5%). No cross-margin, no partial liquidation in v0.1.

If 0G/USDT is not listed on Binance at v0.1 ship time, fall back to a single DEX OHLCV source. The dataset metadata records `source: "binance"` or `source: "dex:<aggregator>"` explicitly, so verifiers can re-derive.

---

## 3. Trust model

Zero Arena's verification story is **layered**. Each tier is independently shippable and the certificate explicitly tags which tier produced it. V0.1 is honest about what it cryptographically guarantees vs. what it leaves to social trust.

| Tier | Mechanism | What it proves | What it does NOT prove | Available |
| - | - | - | - | - |
| **T1 — Commitment** | `runHash` anchored on 0G Chain. The submitter has bound themselves to a specific `(agent, dataset, options, trades)` tuple at block timestamp T. | Trades cannot be edited after submission. Public metrics are computed deterministically from the committed trades. | That the trades were actually produced by running the agent on the dataset. | v0.1 |
| **T2 — Reproducibility** | The agent owner can share the encrypted agent + AES key with a chosen verifier, who reruns and asserts the same `runHash`. | To anyone the owner authorizes: the trades are the unique deterministic output of running this agent on this dataset. | Anything to a verifier who lacks the agent code/key. Strategy is revealed to verifiers. | v0.1 |
| **T3 — TEE attestation** | Our `BacktestEngine` + the developer's agent code run inside **0G Compute** as a generic confidential-compute substrate (Intel TDX + NVIDIA H100/H200 enclave). The TEE signs the run; the certificate stores the attestation report alongside `runHash`. | Trades were produced by the committed agent on the committed dataset, **without revealing the agent code** to anyone — verifier, 0G operator, or Zero Arena. | Activity outside the TEE boundary (e.g., an agent that calls an external LLM API — that edge can use TeeTLS for a signed receipt of which provider returned what, but the model itself remains the developer's choice and their trust assumption). | v0.2 |

V0.1 ships **T1 + T2 only.** Certificates carry `trustTier: "T2"`. The honest pitch:

> "Strategy never leaves your machine in plaintext. Metrics are cryptographically committed and reproducible by anyone you authorize. Trustless third-party verification ships in v0.2 via 0G Compute Sealed Inference."

**Do not** market v0.1 as "trustless" or "fully verifiable to a stranger." The T1+T2 story is strong and defensible; overclaiming kills credibility.

### Why 0G specifically enables T3

We use 0G Compute strictly as a **generic TEE compute substrate**. We do not use, host, or proxy any first-party 0G models. The trust upgrade comes from the hardware enclave, not from anything model-related.

- **0G Compute (TeeML mode)** lets us register `BacktestEngine` as a deterministic Docker image and run it inside an Intel TDX + NVIDIA H100/H200 enclave. The image's measurement is published on-chain; only that exact image can produce valid T3 quotes. Model-agnostic — the agent inside the engine can be anything the developer wrote.
- **0G Compute (TeeTLS mode)** is available for agents that make outbound HTTPS calls (e.g., to Anthropic, OpenAI, a self-hosted endpoint). The broker captures the provider's TLS certificate fingerprint, hashes the request/response pair, and signs the bundle inside the TEE. The developer still chooses the model — we just give them a signed receipt of which external endpoint returned what. We never substitute or rewrite the call.
- The 0G Compute SDK already exposes `verifyService()` and `processResponse()` so any third party can independently verify the TEE quote against an on-chain attestation report.
- The **ERC-7857 oracle re-encryption flow** is defined to run inside a TEE (per the 0G iNFT spec), so the same enclave that re-encrypts metadata at transfer time can host the rerun-and-verify step.

The v0.2 plan: package `BacktestEngine` as a deterministic Docker image, publish its content hash on-chain, and run it inside 0G Compute. The TEE's signed quote becomes a third co-signature on `runHash`. The developer's agent code, model choice, and any external API calls are entirely their concern — we just attest that the engine ran honestly on the committed inputs.

---

## 4. Repository structure

The project is split across the [`Zero-Arena`](https://github.com/Zero-Arena) GitHub organization. Each repo has a single, narrow responsibility.

| Repo | Responsibility | Stack | Hackathon priority |
| - | - | - | - |
| [`Zero-Arena/zero-arena-sdk`](https://github.com/Zero-Arena/zero-arena-sdk) | The `zeroarena` npm package: TS SDK, CLI, examples integration. Published to npm. | TypeScript, ethers v6, `@0gfoundation/0g-storage-ts-sdk` | P0 |
| [`Zero-Arena/zero-arena-contracts`](https://github.com/Zero-Arena/zero-arena-contracts) | Solidity contracts, Foundry config, deployment scripts, ABI publishing. | Solidity 0.8.24, Foundry (forge + cast + anvil), OpenZeppelin Contracts | P0 |
| [`Zero-Arena/zero-arena-example-agent`](https://github.com/Zero-Arena/zero-arena-example-agent) | Reference agents, sample dataset, e2e walkthrough scripts, Binance ingestion. | TypeScript | P1 |
| [`Zero-Arena/.github`](https://github.com/Zero-Arena/.github) | Org profile README, contribution guide, issue templates. | Markdown | P2 |
| [`Zero-Arena/zero-arena-docs`](https://github.com/Zero-Arena/zero-arena-docs) | Public docs site (Docusaurus or similar). | — | post-hackathon |

**Why split this way:**

- `sdk` and `contracts` evolve at different cadences. Contract redeploys must not force npm version bumps.
- Auditors reviewing on-chain logic should not have to wade through TypeScript build config; the `contracts` repo is Foundry-only.
- `examples` being separate keeps the SDK's package size small (no demo CSVs in the npm tarball).
- The org-level README lives in `.github/profile/README.md` so it renders on the org page.

---

## 5. Cross-repo coupling

The two active code repos couple via a **published-artifact pattern**, not a monorepo or git submodule.

```
contracts (deploy) ──► publishes ABIs + deployed addresses as a GitHub Release
                                                     │
                                                     ▼
                                  sdk consumes via @zero-arena/contracts npm package
                                  (or downloads the release tarball at build time)
```

Concretely:

1. `Zero-Arena/zero-arena-contracts` publishes a tiny npm package `@zero-arena/contracts` containing only:
   - `abi/AgentCertificate.json`
   - `abi/ZeroArenaINFT.json`
   - `addresses.json` (network → contract address map)
   - `index.ts` re-exporting the above with TypeScript types
2. `Zero-Arena/zero-arena-sdk` adds `@zero-arena/contracts` as a dependency.
3. Contract redeploy → bump `@zero-arena/contracts` patch → bump `zeroarena` patch.

This keeps the SDK self-contained for end users (`npm i zeroarena` and you're done) without bundling Foundry or Solidity tooling into the runtime install.

---

## 6. Hard scope rules

| Decision | Choice | Rationale |
| - | - | - |
| Language (SDK) | TypeScript only | Aligns with `@0gfoundation/0g-storage-ts-sdk`. No Python. |
| Encryption | AES-256-GCM (single symmetric key per artifact) | Simplest path; SDK supports it natively. GCM gives authenticated encryption. |
| iNFT transfer flow | Full ERC-7857 with oracle re-encryption | Hackathon differentiator. Worth the extra day. |
| Trust tier shipped in v0.1 | T1 (commitment) + T2 (reproducibility). T3 is v0.2. | Honest scoping. T3 needs 0G Compute integration which is a v0.2 milestone. |
| Datasets | OHLCV CSV → uploaded once, referenced by `datasetHash` + storage root | No live data feeds. No DA. See §2. |
| Markets | BTC/USDT spot (P0), 0G/USDT spot (P0), BTC perp (P1), 0G perp (P2) | Narrow MVP. See §2. |
| ML | None. Rule-based + LLM agents only | RL training is not v0.1. |
| Network | 0G Testnet (Galileo) only | Mainnet is v1.0. |
| Smart contracts | Three: `AgentCertificate`, `ZeroArenaINFT`, `ReencryptionOracle` | Minimum to demonstrate the flow. |
| Frontend | None. CLI + library only. | Demo runs in a terminal recording. |

If a feature is not on this table, it is not in v0.1.

---

## 7. Repo: `Zero-Arena/zero-arena-sdk`

The `zeroarena` npm package.

### Layout

```
sdk/
├── package.json                        # name: "zeroarena"
├── tsconfig.json
├── README.md                           # public-facing SDK docs
├── LICENSE
├── .github/workflows/
│   ├── ci.yml                          # lint, test, type-check on PR
│   └── publish.yml                     # publish to npm on tag push
├── src/
│   ├── index.ts                        # public exports
│   ├── ZeroArena.ts                    # main facade class
│   ├── agent/
│   │   ├── Agent.ts                    # abstract base class
│   │   └── types.ts                    # Observation, Action, AgentMetadata
│   ├── backtest/
│   │   ├── BacktestEngine.ts           # deterministic loop (spot + perp)
│   │   ├── indicators.ts               # RSI, MACD, EMA — pure functions
│   │   ├── portfolio.ts                # PnL, position, drawdown tracking
│   │   ├── perp.ts                     # leverage, funding accrual, liquidation
│   │   ├── metrics.ts                  # Sharpe, win rate, profit factor
│   │   └── hash.ts                     # canonical hashing (runHash)
│   ├── storage/
│   │   ├── StorageAdapter.ts           # wraps 0G Storage SDK + AES-256
│   │   └── encryption.ts               # key gen, encrypt, decrypt helpers
│   ├── chain/
│   │   ├── ChainAdapter.ts             # ethers v6 wrapper
│   │   └── (ABIs imported from @zero-arena/contracts)
│   ├── inft/
│   │   ├── MintAdapter.ts              # mint flow
│   │   └── TransferAdapter.ts          # ERC-7857 oracle transfer flow
│   └── cli/
│       ├── index.ts                    # commander.js entry
│       └── commands/
│           ├── dataset.ts              # dataset:upload
│           ├── backtest.ts
│           ├── certify.ts
│           └── mint.ts
└── test/
    ├── backtest.test.ts                # determinism test (critical)
    ├── perp.test.ts                    # funding + liquidation tests
    ├── storage.test.ts
    ├── chain.test.ts
    └── e2e.test.ts                     # full flow on testnet
```

### Public API surface

Lock down on day one. Don't break it.

```ts
// src/index.ts
export { ZeroArena } from './ZeroArena';
export { Agent } from './agent/Agent';
export type {
  Observation, Action, Dataset,
  BacktestOptions, BacktestResult,
  Certificate, INFT, TrustTier,
  ZeroArenaConfig,
} from './types';
```

```ts
type TrustTier = 'T1' | 'T2' | 'T3';

interface BacktestOptions {
  initialBalance: number;
  market: 'spot' | 'perp';
  leverage?: number;        // perp only, default 1, capped at 10 in v0.1
  feeBps?: number;          // taker fee, default 10 (0.10%)
  slippageBps?: number;     // default 5
}

class ZeroArena {
  constructor(config: ZeroArenaConfig);

  uploadDataset(csvPath: string): Promise<Dataset>;
  loadDataset(opts: { rootHash: string }): Promise<Dataset>;

  backtest(agent: Agent, dataset: Dataset, opts: BacktestOptions): Promise<BacktestResult>;
  certify(result: BacktestResult): Promise<Certificate>; // tier defaults to T2 in v0.1

  mintAgent(opts: {
    agent: Agent;
    certificate: Certificate;
    name: string;
    description?: string;
  }): Promise<INFT>;

  transferAgent(opts: {
    tokenId: bigint;
    to: string;
    recipientPubKey: string;
  }): Promise<TransferResult>;
}

abstract class Agent {
  abstract decide(obs: Observation): Promise<Action>;
  toJSON(): Record<string, unknown> {
    return { className: this.constructor.name };
  }
}
```

### Determinism rules (non-negotiable)

The whole verifiability story collapses if backtests aren't reproducible. Enforce these:

1. **No `Math.random()` in `BacktestEngine`.** Use a seeded PRNG if randomness is ever needed.
2. **No real timestamps.** Use the candle's `timestamp` field, never `Date.now()`.
3. **Indicator math uses fixed iteration order.** No `for...in` on objects in the hot path.
4. **Canonical `runHash`:**

   ```
   runHash = keccak256(
     agentHash || datasetHash || encodeBacktestOptions(opts) || encodeTradesArray(trades)
   )
   ```

   `agentHash = keccak256(stableStringify(agent.toJSON()))`. The stable serializer (sorted keys) is non-negotiable.
5. **Mandatory CI test:** run the same agent + dataset 10 times in a row, assert all 10 `runHash` values match. Run separately for `market: 'spot'` and `market: 'perp'`.

---

## 8. Repo: `Zero-Arena/zero-arena-contracts`

Solidity contracts and deployment infrastructure. **Foundry only — no Hardhat.** Base contracts and security primitives come from OpenZeppelin.

### Tooling

- **Foundry** (`forge` for build/test, `cast` for chain queries, `anvil` for local fork). Configured via `foundry.toml`.
- **OpenZeppelin Contracts** as the base layer. Pulled via `forge install OpenZeppelin/openzeppelin-contracts`. Pin to a specific tag (`v5.x`) in `remappings.txt` so reproducible builds work.
- **`forge-std`** for testing utilities (`Test`, `console2`, `vm`).
- **`solady`** optional for gas-optimized building blocks (e.g., `LibString`, `EIP712`) if needed; OpenZeppelin first, solady only when justified.
- A tiny **`package.json`** lives at repo root for one purpose only: publishing the ABI artifact as `@zero-arena/contracts` to npm. It does not pull in Hardhat or any JS testing framework.

### Layout

```
contracts/
├── foundry.toml                        # Foundry config
├── remappings.txt                      # @openzeppelin/=lib/openzeppelin-contracts/, etc.
├── package.json                        # name: "@zero-arena/contracts" (publish only)
├── README.md                           # contract docs, audit notes, addresses
├── LICENSE
├── .gitmodules                         # OZ + forge-std as submodules
├── .github/workflows/
│   ├── ci.yml                          # forge fmt --check, forge build, forge test
│   └── publish.yml                     # publish ABIs + addresses to npm on tag
├── src/
│   ├── AgentCertificate.sol
│   ├── ZeroArenaINFT.sol               # ERC-7857 (extends OZ ERC721)
│   ├── interfaces/
│   │   └── IERC7857.sol
│   └── oracle/
│       └── ReencryptionOracle.sol      # MVP oracle (off-chain TEE simulated)
├── script/
│   ├── DeployAll.s.sol                 # forge script, broadcasts all 3 contracts
│   ├── DeployCertificate.s.sol
│   └── DeployINFT.s.sol
├── test/
│   ├── AgentCertificate.t.sol
│   ├── ZeroArenaINFT.t.sol
│   ├── TransferFlow.t.sol              # full e2e oracle transfer
│   └── invariants/
│       └── INFT.invariants.t.sol       # forge invariant testing
├── lib/                                # forge submodules (gitignored content, .gitmodules tracked)
│   ├── openzeppelin-contracts/
│   └── forge-std/
├── deployments/
│   ├── galileo-testnet.json            # checked-in addresses per network
│   └── README.md
└── dist/                               # the published npm package contents
    ├── abi/
    ├── addresses.json
    └── index.ts
```

### `foundry.toml` (essentials)

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"
optimizer = true
optimizer_runs = 200
via_ir = false
fs_permissions = [{ access = "read-write", path = "./deployments" }]

[profile.ci]
fuzz = { runs = 10000 }
invariant = { runs = 1000, depth = 50 }

[rpc_endpoints]
galileo = "${GALILEO_RPC_URL}"

[etherscan]
galileo = { key = "${GALILEO_EXPLORER_KEY}", url = "${GALILEO_EXPLORER_URL}" }
```

### `remappings.txt`

```
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
forge-std/=lib/forge-std/src/
```

### `AgentCertificate.sol`

Uses OpenZeppelin's `Ownable2Step` so an admin role exists for future threshold updates without making the contract upgradeable.

The struct adds a `trustTier` byte (`0x01` = T1, `0x02` = T2, `0x03` = T3) and an optional `attestationHash` slot reserved for v0.2's TEE attestation report root.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

contract AgentCertificate is Ownable2Step {
    struct Certificate {
        bytes32 runHash;
        bytes32 storageRootHash;
        bytes32 datasetHash;
        bytes32 attestationHash;     // 0x0 in v0.1 (T2). Set in v0.2 (T3) to the 0G Compute attestation report root.
        int256  totalReturnBps;
        uint256 sharpeX1000;
        uint256 maxDrawdownBps;
        uint256 winRateBps;
        address owner;
        uint64  createdAt;
        uint8   trustTier;           // 1=T1, 2=T2, 3=T3
        uint8   market;              // 0=spot, 1=perp
    }

    uint256 public nextCertId = 1;
    mapping(uint256 => Certificate) public certificates;

    event CertificateSubmitted(
        uint256 indexed certId,
        address indexed owner,
        bytes32 runHash,
        bytes32 storageRootHash,
        uint8   trustTier
    );

    constructor(address admin) Ownable(admin) {}

    function submit(
        bytes32 runHash,
        bytes32 storageRootHash,
        bytes32 datasetHash,
        bytes32 attestationHash,
        int256  totalReturnBps,
        uint256 sharpeX1000,
        uint256 maxDrawdownBps,
        uint256 winRateBps,
        uint8   trustTier,
        uint8   market
    ) external returns (uint256 certId) {
        require(trustTier >= 1 && trustTier <= 3, "bad tier");
        require(market <= 1, "bad market");
        certId = nextCertId++;
        certificates[certId] = Certificate({
            runHash: runHash,
            storageRootHash: storageRootHash,
            datasetHash: datasetHash,
            attestationHash: attestationHash,
            totalReturnBps: totalReturnBps,
            sharpeX1000: sharpeX1000,
            maxDrawdownBps: maxDrawdownBps,
            winRateBps: winRateBps,
            owner: msg.sender,
            createdAt: uint64(block.timestamp),
            trustTier: trustTier,
            market: market
        });
        emit CertificateSubmitted(certId, msg.sender, runHash, storageRootHash, trustTier);
    }

    function get(uint256 certId) external view returns (Certificate memory) {
        return certificates[certId];
    }
}
```

### `ZeroArenaINFT.sol`

ERC-7857 builds on top of `ERC721` from OpenZeppelin. Inherit cleanly, add the encrypted-metadata fields and the oracle transfer flow on top.

The interface follows the 0G ERC-7857 spec:

```solidity
function transfer(address from, address to, uint256 tokenId, bytes calldata sealedKey, bytes calldata proof) external;
function clone(address to, uint256 tokenId, bytes calldata sealedKey, bytes calldata proof) external returns (uint256 newTokenId);
function authorizeUsage(uint256 tokenId, address executor, bytes calldata permissions) external;
```

The oracle is required to expose:

```solidity
function verifyProof(bytes calldata proof) external view returns (bool);
```

Key design choices:

- **`ERC721` from OZ**, not a hand-rolled implementation. Saves audit surface, gets `tokenURI`, `Approval`, `Transfer` events for free.
- **`Ownable2Step`** instead of plain `Ownable`. Two-step ownership transfer prevents accidental loss of admin.
- **`ReentrancyGuard`** on `initiateTransfer` and `claimTransfer` because they touch external state (`AgentCertificate`) and emit value-bearing events.
- **`ECDSA`** library for verifying the oracle's signed re-encryption proof.
- The native ERC-721 `transferFrom` and `safeTransferFrom` are **overridden to revert** for tokens that have encrypted metadata, forcing transfers through the ERC-7857 oracle flow. This is the whole point of ERC-7857 — vanilla 721 transfers leak the encrypted blob to a new owner who has no key.

### `ReencryptionOracle.sol`

For the MVP, this is a thin contract that records the off-chain oracle's signed messages on-chain so transfers can be replayed and audited. The actual re-encryption happens in `sdk/src/inft/TransferAdapter.ts` using a key the oracle service holds. This is a **trusted oracle stub** for v0.1 — explicitly documented as such, with the v0.2 plan being to replace `verifyProof` with TEE attestation verification against 0G Compute Sealed Inference quotes. Judges accept this when the architecture supports the upgrade.

### Testing strategy (Foundry)

- **Unit tests** in `*.t.sol` files using `forge-std/Test.sol`. Aim for ≥90% line coverage on `AgentCertificate` and the mint path of `ZeroArenaINFT`.
- **Fuzz tests** on every public function that takes user input. CI profile runs 10,000 fuzz runs per test.
- **Invariant tests** in `test/invariants/` for `ZeroArenaINFT`: e.g., total supply equals number of `Mint` events, every existing token has a non-zero `metadataHash`.
- **Fork tests** against Galileo testnet for integration verification before tagging a release: `forge test --fork-url $GALILEO_RPC_URL --match-contract ForkTest`.
- **Gas snapshots** via `forge snapshot`. Commit `.gas-snapshot` so PRs flag gas regressions.

### Deployment

Single-command deploy via Foundry script:

```bash
forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url $GALILEO_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify
```

The script writes addresses to `deployments/galileo-testnet.json`, which is checked into git and consumed by the npm publishing step.

### Published artifact: `@zero-arena/contracts`

After deploy, a small Node script reads `out/*.sol/*.json` (Foundry build output), extracts ABIs, merges with `deployments/galileo-testnet.json`, and writes a slim npm package the SDK consumes:

```ts
// Consumed in sdk/src/chain/ChainAdapter.ts
import { abi, addresses } from '@zero-arena/contracts';
const cert = new ethers.Contract(
  addresses.galileo.AgentCertificate,
  abi.AgentCertificate,
  signer
);
```

Versioning: tag the contracts repo as `v0.1.0` after deploy → CI publishes `@zero-arena/contracts@0.1.0` → bump SDK dependency → SDK release.

---

## 9. Repo: `Zero-Arena/zero-arena-example-agent`

End-to-end walkthroughs. Not published to npm.

### Layout

```
examples/
├── README.md                           # overview + how to run each example
├── package.json                        # depends on "zeroarena" + "@anthropic-ai/sdk"
├── 00-binance-ingest/
│   ├── README.md
│   ├── ingest.ts                       # fetch BTC + 0G OHLCV (spot + perp), normalize, hash, upload
│   └── schema.ts                       # canonical CSV schema + funding rate handling
├── 01-rsi-agent-btc-spot/
│   ├── README.md
│   ├── agent.ts                        # rule-based RSI mean reversion on BTC/USDT spot
│   └── run.ts                          # full backtest → certify → mint flow
├── 02-claude-llm-agent-0g-spot/
│   ├── README.md
│   ├── agent.ts                        # Claude-as-trader on 0G/USDT spot, uses Anthropic SDK
│   └── run.ts                          # surfaces the LLM-tier caveat (T2 only, no T3 until v0.2)
├── 03-perp-momentum-agent/
│   ├── README.md
│   ├── agent.ts                        # leveraged momentum on BTC perp, demonstrates funding + liquidation
│   └── run.ts
├── 04-transfer-flow/
│   ├── README.md
│   └── transfer.ts                     # demonstrates ERC-7857 oracle transfer between two wallets
└── data/
    ├── datasets.lock.json              # storage roots + dataset hashes for the BTC/0G corpus
    └── (raw CSVs are uploaded to 0G Storage, NOT checked into git)
```

Each example has its own README with copy-pasteable terminal commands. The judge should be able to clone one example folder and run it without reading the SDK source.

The `data/` folder holds **only** `datasets.lock.json` — the actual CSV bytes live on 0G Storage and are downloaded on demand via `za.loadDataset({ rootHash })`. This keeps the repo tiny and proves the storage round-trip every time someone runs an example.

### Specific example contracts

- `01-rsi-agent-btc-spot` is the canonical "5-minute install-and-run" demo for the README. Must be the simplest possible.
- `02-claude-llm-agent-0g-spot` shows one example of the LLM trader pattern. We use Anthropic's Claude here because it's a familiar reference; the developer can swap in any LLM (GPT, Gemini, self-hosted, fine-tuned) — model choice is theirs, not ours. README explicitly notes: "LLM responses are recorded in the run log; reproducibility (T2) requires the same API responses, which is not guaranteed across calls. v0.2 lifts this to T3 by running the agent inside a 0G Compute TEE and capturing TeeTLS-signed receipts of the outbound API calls — the developer's chosen model is unchanged, we just attest the call."
- `03-perp-momentum-agent` exists primarily to exercise the perp code path (leverage, funding, liquidation) so judges see the futures market is more than a flag.
- `04-transfer-flow` is optional — drop it from the demo flow if day 5 slips on the oracle.

---

## 10. Build order (7-day plan)

| Day | Repo | Deliverable |
| - | - | - |
| 1 | `sdk` | Repo scaffold, `Agent`, `Observation`, `Action`, indicators, spot portfolio |
| 2 | `sdk` | `BacktestEngine` (spot path) + canonical hashing + determinism unit test passing. `perp.ts` skeleton with funding accrual + liquidation. |
| 3 | `sdk` + `examples` | `StorageAdapter` (0G Storage upload/download + AES-256), tested on testnet. `00-binance-ingest` script working — BTC/USDT + 0G/USDT spot uploaded, `datasets.lock.json` committed. |
| 4 | `contracts` | All three contracts deployed to Galileo testnet via `forge script`, ABIs published as `@zero-arena/contracts@0.1.0`. Fuzz + invariant tests passing. Certificate struct includes `trustTier` and `attestationHash` (zero for v0.1). |
| 5 | `sdk` | `MintAdapter`, `TransferAdapter` (oracle stub), CLI commands, integration test green. Perp determinism test passing. |
| 6 | `examples` | Four working examples (01-04), perp ingestion added if 0G perp is listed. E2E demo runs clean against Galileo. |
| 7 | all | README polish, demo video, npm publish `zeroarena@0.1.0`, X post, submission. Trust model section explicit in every README. |

If day 4 slips on the oracle transfer flow, drop `transferAgent` from the public API and ship mint-only. The README says "Transfer coming in v0.2" — defensible. Don't slip days 1–3.

If day 3 slips on Binance ingestion (e.g., 0G not yet on Binance), ship with BTC/USDT spot only and a single DEX-sourced 0G dataset. Don't slip past day 4 trying to chase exchange listings.

---

## 11. Critical risks and mitigations

| Risk | Mitigation |
| - | - |
| 0G Storage SDK behaves differently in testnet than docs suggest | Test the upload/download round-trip on day 1. Don't trust docs blindly. |
| 0G/USDT not yet listed on Binance at v0.1 ship time | Fall back to a DEX OHLCV source for 0G. Tag the dataset metadata `source: "dex:<aggregator>"`. Don't slip the schedule to wait on a listing. |
| ERC-7857 oracle flow turns out to be ill-defined | Have the mint-only fallback ready. Ship the simpler thing if blocked. |
| Determinism test fails due to float order issues | Switch indicator math to fixed-point if needed. |
| Perp liquidation logic introduces non-determinism | Cap leverage at 10x, isolated margin only, single liquidation event per position. Same dataset + same agent = same liquidations. |
| Funding rate accrual drifts vs. exchange | Snapshot the funding rate per 8h window into the dataset itself, not fetched live. Dataset hash covers it. |
| Gas cost on certificate submission is high | Pack metrics into a single struct, batch if needed. Probably fine on Galileo. |
| LLM agent example breaks reproducibility | Document explicitly that LLM `runHash` covers the recorded outputs only, not the inference. T2 only. T3 requires v0.2 + 0G Compute. |
| Judges expect T3 in v0.1 | The trust model table is the answer. Show the architecture supports T3 cleanly via 0G Compute Sealed Inference, point to v0.2 milestone, demo the certificate's `trustTier` field. |
| npm name `zeroarena` already taken | Check on day 1. Fallbacks: `@zero-arena/sdk`, `0g-zeroarena`. |
| `@zero-arena` npm scope already taken | Register the scope on day 1 alongside the GitHub org. |

---

## 12. Demo video script (3 min)

| Time | Visual | Voiceover |
| - | - | - |
| 0:00–0:15 | Title card | "AI trading agents claim 80% accuracy. None of those claims are verifiable — and demanding the source destroys the IP." |
| 0:15–0:30 | Problem diagram + trust model table | "Zero Arena is the npm package that fixes this. Backtest, certify, mint — strategy stays sealed." |
| 0:30–0:50 | Terminal: `npm install zeroarena` + `npx zeroarena ingest` | "One install. BTC and 0G data fetched from Binance, uploaded to 0G Storage, hash committed." |
| 0:50–1:30 | VS Code: `examples/01-rsi-agent-btc-spot` walkthrough | "Define your agent. One method: `decide`. Run a deterministic backtest." |
| 1:30–2:00 | Terminal: `npx zeroarena certify` | "Run log encrypted with AES-256, uploaded to 0G Storage. RunHash + metrics + trust tier anchored on 0G Chain." |
| 2:00–2:30 | Terminal: `npx zeroarena mint` | "Agent minted as ERC-7857 iNFT. Transferable via the oracle re-encryption flow. Strategy never decrypted off-chain." |
| 2:30–2:50 | 0G Explorer: tx, contract, NFT | "Every artifact is on-chain or in 0G Storage. T1 + T2 verifiable today. T3 — full TEE attestation via 0G Compute Sealed Inference — ships in v0.2." |
| 2:50–3:00 | Closing card + npm + GitHub org link | "Zero Arena. Verifiable performance for AI trading agents. Built on 0G." |

---

## 13. Out of scope for v0.1 (don't even start)

- Live trading
- Real exchange execution (paper or otherwise)
- 0G Compute integration (this is the v0.2 work — see §3 and §14)
- 0G DA integration
- Reinforcement learning training loop
- Python anything
- React dashboard
- Multi-agent orchestration
- Arena seasons / leaderboard contracts
- Reward distribution
- Multi-asset universe beyond BTC + 0G
- DEX aggregator data feeds (only as a fallback if 0G isn't on Binance)

These all live in the post-hackathon roadmap. Mention them in the org README's Roadmap section so judges see the vision, but do not write a single line of code for them before May 16.

---

## 14. Roadmap to T3 (post-MVP)

V0.2 lifts the trust model to T3 by running our deterministic engine inside 0G Compute as a generic confidential-compute substrate. **0G is used for the enclave, not for any model.** None of the v0.1 surface changes.

1. **Package `BacktestEngine` as a deterministic Docker image.** Pin the Node version, lockfile, and OS layer. Publish the image's content digest. The image contains only our engine — the user's agent code is loaded into it at runtime from encrypted 0G Storage.
2. **Register the engine image with 0G Compute** as a TeeML service. The TEE loads the image, fetches the encrypted (agent + dataset) blob from 0G Storage, decrypts in-enclave, runs, and emits a signed quote. The user's strategy never appears in plaintext outside the enclave.
3. **Add `attestationHash` population** in `AgentCertificate.submit()`. The hash is the keccak of the TEE quote bundle (attestation report + image measurement + signature).
4. **Add an on-chain verifier contract** that checks the TEE quote against the registered `MRENCLAVE` / image digest. The certificate's `trustTier` is set to T3 only after the verifier returns true.
5. **For agents that make outbound calls** (e.g., to an external LLM API), the agent runs the call from inside the TEE via 0G Compute's TeeTLS broker. The broker captures the provider's TLS certificate fingerprint and signs `(request_hash, response_hash, fingerprint)` inside the TEE. The signed receipt is recorded in the run log and covered by `runHash`. **We do not substitute, proxy, or rewrite the call** — the developer keeps their chosen model and provider, we just give a verifiable audit trail of which endpoint returned what.
6. **Replace the `ReencryptionOracle` stub** in the iNFT contract with a TEE-attested oracle that verifies real Sealed Inference quotes for the re-encryption step.

Each step is independent. The certificate format already reserves the slots; the SDK already has the trust-tier enum; the contract already has the field. V0.2 is wiring, not redesign.

**What we will never do:** offer a first-party model, a recommended model list, or a "Zero Arena LLM endpoint." The model choice belongs to the developer. We are infrastructure.

---

## 15. Definition of done (May 16)

A reviewer must be able to:

1. Land on [`github.com/Zero-Arena`](https://github.com/Zero-Arena), see the org README, and immediately understand the project from the repo layout — including the trust model and the v0.1 vs. v0.2 split.
2. Run `npm install zeroarena` from a clean machine.
3. Copy the Quick Start from the SDK README into a `.ts` file.
4. Set `PRIVATE_KEY` in `.env` (testnet wallet with Galileo gas).
5. Run the script (RSI agent on BTC/USDT spot).
6. See: a `runHash` printed, a `certId` on 0G Chain (linkable on the explorer, tagged `trustTier: T2`), and a minted iNFT with metadata stored on 0G Storage.
7. Read the README and understand exactly what T1 + T2 prove and what they don't, and how T3 is reached in v0.2.

If any of those steps requires hand-holding, the project is not done.
