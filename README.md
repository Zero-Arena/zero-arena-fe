# Zero Arena

> **Verifiable performance infrastructure for AI trading agents.**
> Prove your winrate and ROI without revealing your strategy. Backtest → Certificate → ERC-7857 mint, in 5 lines of TypeScript.

[![0G](https://img.shields.io/badge/built%20on-0G-black)](https://0g.ai)
[![License](https://img.shields.io/badge/license-MIT-black)](./LICENSE)

Anyone can claim "my agent gets 70% winrate, 3x ROI." Today there is no way for a third party to verify that claim without either (a) trusting the claimant, or (b) demanding the source code, which destroys the IP.

Zero Arena closes that gap. Run a deterministic backtest, anchor the run hash on 0G Chain, encrypt your agent into 0G Storage, and mint it as an ERC-7857 Intelligent NFT. The strategy never leaves your machine in plaintext; only the metrics and the cryptographic commitment to a specific run are public.

The agent intelligence is solved. The infrastructure trust is not. Zero Arena solves that.

---

## Repositories

This GitHub organization is structured as a multi-repo project. Each repo has a single responsibility.

| Repo | Purpose | Status |
| - | - | - |
| **[`zero-arena-sdk`](https://github.com/Zero-Arena/zero-arena-sdk)** | The `zeroarena` npm package — TypeScript SDK + CLI | active |
| **[`zero-arena-contracts`](https://github.com/Zero-Arena/zero-arena-contracts)** | Solidity contracts (Certificate + ERC-7857 iNFT) and Foundry deploy scripts | active |
| **[`zero-arena-example-agent`](https://github.com/Zero-Arena/zero-arena-example-agent)** | Reference agents, Binance data ingestion, e2e demos | active |
| **[`zero-arena-docs`](https://github.com/Zero-Arena/zero-arena-docs)** | Documentation site | post-hackathon |

If you are a developer, start at [`zero-arena-sdk`](https://github.com/Zero-Arena/zero-arena-sdk).
If you are auditing the on-chain logic, start at [`zero-arena-contracts`](https://github.com/Zero-Arena/zero-arena-contracts).
If you want a working demo to run end-to-end, start at [`zero-arena-example-agent`](https://github.com/Zero-Arena/zero-arena-example-agent).

---

## Trust model

Verification is layered. Every certificate is tagged with the tier it shipped under. We are explicit about what each tier proves — and what it does not.

| Tier | What it proves | What it does NOT prove | Available |
| - | - | - | - |
| **T1 — Commitment** | The submitter is bound to a specific `(agent, dataset, options, trades)` tuple at block timestamp T. Trades cannot be edited after submission; metrics are derived deterministically from those trades. | That the trades were actually produced by running the agent on the dataset. | **v0.1** |
| **T2 — Reproducibility** | The agent owner can grant a chosen verifier the encrypted agent + AES key. The verifier reruns and asserts the same `runHash`. | Anything to a verifier who lacks the agent code. Strategy is revealed to verifiers, so this only works for owner-selected counterparties. | **v0.1** |
| **T3 — TEE attestation** | Our `BacktestEngine` + the developer's agent code run inside **0G Compute** as a generic confidential-compute enclave (Intel TDX + NVIDIA H100/H200). Trades are produced by the committed agent on the committed dataset, **without revealing the agent code** to anyone — verifier, 0G operator, or Zero Arena. | Activity outside the TEE boundary (e.g., agents calling external LLM APIs — TeeTLS gives a signed receipt of what came back, but the model itself remains the developer's trust assumption). | **v0.2** |

V0.1 ships T1 + T2 only. The architecture supports T3 cleanly — `Certificate.attestationHash` and `Certificate.trustTier` are reserved on day one — and lights up when v0.2 wires in 0G Compute. We do not market v0.1 as "trustless"; we market it as "strategy stays sealed, metrics are committed, and reproducibility is owner-authorized."

---

## MVP data scope

V0.1 anchors to a narrow, shared corpus so determinism tests, deployed contracts, and demo runs all reference one set of dataset roots. No live data feeds.

| Asset | Market | Source | Granularity | Window | Status |
| - | - | - | - | - | - |
| BTC/USDT | Spot | Binance | 1h candles | last 365 days | P0 |
| 0G/USDT | Spot | Binance (or DEX fallback) | 1h candles | from listing date | P0 |
| BTC/USDT | Perpetual futures | Binance Futures | 1h candles + funding | last 365 days | P1 |
| 0G/USDT | Perpetual futures | Binance Futures if listed | 1h candles + funding | from listing date | stretch |

A one-shot ingestion script (`zero-arena-example-agent/00-binance-ingest`) fetches each series, normalizes to a canonical CSV, computes the dataset hash, uploads to 0G Storage, and writes the storage roots into a checked-in `datasets.lock.json`. Every backtest across every machine anchors to the same bytes.

Spot uses long-only no-leverage math. Perpetual futures adds configurable leverage (default 3x, capped at 10x), 8h funding accrual, and isolated-margin liquidation.

---

## Quick start

```bash
npm install zeroarena
```

```ts
import { ZeroArena, Agent } from 'zeroarena';

const za = new ZeroArena({
  rpc: 'https://evmrpc-testnet.0g.ai',
  indexer: 'https://indexer-storage-testnet-turbo.0g.ai',
  privateKey: process.env.PRIVATE_KEY!,
});

// Loads BTC/USDT 1h spot data from 0G Storage by root hash.
const dataset = await za.loadDataset({ rootHash: '0xabc...' });

class RsiAgent extends Agent {
  async decide(obs) {
    if (obs.rsi14 < 30) return { direction: 1, size: 0.2 };
    if (obs.rsi14 > 70) return { direction: -1, size: 0.2 };
    return { direction: 0, size: 0 };
  }
}

const result = await za.backtest(new RsiAgent(), dataset, {
  initialBalance: 10_000,
  market: 'spot',
});
const cert = await za.certify(result);     // tier defaults to T2 in v0.1
const inft = await za.mintAgent({
  agent: new RsiAgent(),
  certificate: cert,
  name: 'RSI Mean Reversion v1',
});
```

Five steps. Full walkthrough lives in [`zero-arena-example-agent/01-rsi-agent-btc-spot`](https://github.com/Zero-Arena/zero-arena-example-agent).

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  zeroarena (npm — published from zero-arena-sdk)           │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Backtest     │  │ Storage      │  │ Mint + Transfer  │  │
│  │ engine       │  │ adapter      │  │ adapter          │  │
│  │ spot + perp  │  │ AES-256-GCM  │  │ ERC-7857         │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   Local CPU            0G Storage             0G Chain
   (T2 today,         (encrypted blobs:      (Cert + iNFT,
    0G Compute        agent + run log)       trustTier tag)
    Sealed                                         ▲
    Inference                                      │
    in v0.2 = T3)                     ┌────────────┴─────────────┐
                                      │ zero-arena-contracts     │
                                      │ - AgentCertificate.sol   │
                                      │ - ZeroArenaINFT.sol      │
                                      │ - ReencryptionOracle.sol │
                                      └──────────────────────────┘
```

The `sdk` repo consumes ABIs and deployed addresses published from the `contracts` repo via a versioned release artifact, so the two are loosely coupled and independently versionable.

---

## Why 0G

Zero Arena uses 0G as **infrastructure** — storage, chain, and confidential compute. We do not use, host, or proxy any 0G models. We are model-agnostic by design; the developer brings their own agent and their own model (or no model — many trading strategies are pure rules).

- **0G Storage** with built-in AES-256 encryption is the right substrate for proprietary agent IP that needs to be transferable but never exposed in plaintext.
- **0G Chain** gives certificate anchoring and ERC-7857 minting at low cost. The iNFT standard solves the AI-asset transfer problem ERC-721 cannot.
- **0G Compute (TEE substrate)** is the v0.2 unlock. Intel TDX + NVIDIA H100/H200 enclaves let us run our `BacktestEngine` Docker image as a confidential workload — the developer's agent code is decrypted only inside the enclave, the TEE signs a quote over the run, and any third party can verify the quote. This moves the trust model from T2 ("reproducible by anyone you authorize") to T3 ("trustless verification by anyone, agent code never revealed"). For agents that call external APIs (e.g., an LLM endpoint), 0G Compute's TeeTLS broker can sign a receipt of the call without changing what the agent calls — the developer's model choice is preserved.
- **ERC-7857 oracle transfers** make the package immediately interesting for an AI agent marketplace, the obvious post-hackathon direction.

---

## Roadmap

- **v0.1 (0G APAC Hackathon 2026)** — backtest, certify, mint, transfer. BTC + 0G spot (and BTC perp). Trust tiers T1 + T2. Testnet only.
- **v0.2** — T3 attestation via 0G Compute (used as a generic confidential-compute substrate, not for any model). `BacktestEngine` packaged as a TEE-bound Docker image; the developer's agent runs inside that enclave with its own choice of model. Outbound API calls (if any) get TeeTLS-signed receipts. Real TEE-attested oracle replacing the v0.1 stub.
- **v0.3** — multi-asset universe, live paper-trading mode, multiple agent slots per iNFT.
- **v1.0** — mainnet launch, public agent marketplace built on top of the iNFT primitives.

The SDK surface is additive. None of the v0.1 API changes when later phases ship — the `Certificate` struct already reserves `trustTier` and `attestationHash` slots so v0.2 is wiring, not redesign.

---

## References

- 0G Foundation. *0G Storage TypeScript SDK.* [docs.0g.ai/developer-hub/building-on-0g/storage/sdk](https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk)
- 0G Foundation. *0G Compute Network — Inference (TeeML / TeeTLS).* [docs.0g.ai/developer-hub/building-on-0g/compute-network/inference](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/inference)
- 0G Foundation. *Sealed Inference announcement (March 2026).*
- 0G Foundation. *INFTs and ERC-7857.* [docs.0g.ai/developer-hub/building-on-0g/inft/inft-overview](https://docs.0g.ai/developer-hub/building-on-0g/inft/inft-overview)
- Xiong, F., Zhang, X., Feng, A., Sun, S., You, C. (2025). *QuantAgent: Price-Driven Multi-Agent LLMs for High-Frequency Trading.* arXiv:2509.09995.

---

## License

MIT.

---

Built for [0G APAC Hackathon 2026 — Track 2: Agentic Trading Arena](https://0g.ai). Submission deadline: May 16, 2026.
