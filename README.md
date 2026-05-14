# zero-arena-fe

Public dashboard for the [Zero Arena](https://github.com/Zero-Arena) verifiable-trading-agent protocol on 0G Galileo testnet. Renders every minted certificate live from chain — leaderboard, agent registry, and per-cert detail pages with a copy-pasteable verifier flow.

Read-only. The dashboard never asks for keys, never decrypts run logs, never initiates transfers. Trust primitives live in [`zero-arena-sdk`](https://github.com/Zero-Arena/zero-arena-sdk); the FE is a thin viewer over the on-chain state the SDK writes.

---

## Stack

| Layer | Choice |
| - | - |
| Framework | Next.js 16 (Turbopack), React 19, app router |
| Styling | Tailwind 4 (no separate config — `@tailwindcss/postcss`) |
| Chain reads (server) | viem 2 `createPublicClient` |
| Chain reads (client, future) | wagmi 3 + `@tanstack/react-query` |
| Charts | `lightweight-charts` |
| Package manager | pnpm |

Server components fetch certificates via viem's `publicClient` (see `lib/chain/client.ts`); wagmi providers are mounted in `app/providers.tsx` for any client hook (wallet connect today, mint/clone flows in v0.2).

---

## Local dev

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Defaults work out of the box — `lib/chain/contracts.ts` ships hardcoded v0.2 Galileo addresses. To target a different deployment, drop a `.env.local`:

```ini
# zero-arena-fe/.env.local — see .env.example
NEXT_PUBLIC_AGENT_CERTIFICATE_ADDRESS=0x…
NEXT_PUBLIC_ZERO_ARENA_INFT_ADDRESS=0x…
NEXT_PUBLIC_REENCRYPTION_ORACLE_ADDRESS=0x…
NEXT_PUBLIC_LIVE_CERTIFICATE_ADDRESS=0x…
NEXT_PUBLIC_SEASON_ADDRESS=0x…
```

Anything not set falls back to the hardcoded default. Other knobs:

- `lib/chain/galileo.ts` — chain id, RPC URL, explorer, `DEPLOY_BLOCK`
- `lib/chain/contracts.ts` — `CONTRACTS` map + ABIs

The dev server hot-reloads on every save. SSR pages are cached for 60 seconds (`revalidate = 60`) so the leaderboard isn't hitting the RPC on every render.

---

## Pages

| Route | What it shows |
| - | - |
| `/` | Agent Registry — every minted iNFT, filterable by market (spot / perp) |
| `/leaderboard` | Top 3 podium + full ranked table, sortable by Sharpe / return / win rate / drawdown / mints |
| `/agent/[slug]` | Per-cert detail: metrics, equity chart, certificate hashes (clickable), `How to verify` explainer, `Reproduce in your terminal` card with copy buttons, iNFT panel, trade-outcome donut |

Slugs are `cert-${certId}` for chain-derived agents and the legacy `mockAgents[].slug` for placeholder rows that surface when the RPC is unreachable.

---

## Project layout

```
zero-arena-fe/
├── app/
│   ├── layout.tsx                # header + footer + Providers wrap
│   ├── providers.tsx             # WagmiProvider + QueryClientProvider
│   ├── page.tsx                  # Agent Registry (/)
│   ├── leaderboard/page.tsx      # /leaderboard
│   ├── agent/[slug]/
│   │   ├── page.tsx              # /agent/<slug>
│   │   └── PerformanceChart.tsx  # lightweight-charts equity series
│   └── _components/
│       ├── Nav.tsx               # top-bar links
│       ├── ConnectWallet.tsx     # injected connector (MetaMask / Rabby)
│       └── CopyButton.tsx        # async clipboard with Copied badge
├── lib/
│   ├── agents.ts                 # Agent type + helpers + MOCK_AGENTS + fetchAgents()
│   ├── wagmi.ts                  # wagmiConfig (injected connector only)
│   └── chain/
│       ├── galileo.ts            # viem chain definition + explorerUrl()
│       ├── client.ts             # shared publicClient
│       ├── contracts.ts          # addresses + ABIs (parseAbi)
│       ├── readers.ts            # readCertificates() + readAgentMints()
│       └── datasets.ts           # CANONICAL_DATASETS registry (mirrors SDK)
└── public/                       # static assets
```

---

## How chain data flows

```
                       Galileo Testnet (chainId 16602)
                       ─────────────────────────────────
                       AgentCertificate   ZeroArenaINFT
                       0x77f2…b087e       0xF716…700e
                              │                 │
                              │  view + events  │
                              ▼                 ▼
                       lib/chain/readers.ts
                              │
                              │  OnChainCertificate[] + OnChainAgentMint[]
                              ▼
                       lib/agents.ts → fetchAgents()
                              │
                              │  Agent[]  (with deterministic placeholder fields
                              │            for encrypted display data like name)
                              ▼
                       app/(page|leaderboard|agent/[slug])/page.tsx
                              │
                              │  React server component renders
                              ▼
                       <Browser>
```

`fetchAgents()` is graceful: when the Galileo RPC fails, throws, or `nextCertId()` returns 1, the function silently falls back to `MOCK_AGENTS` and the page renders a `Demo data` badge. Production reads always show `Galileo live`.

---

## What stays sealed

Per [`CLAUDE.md` 16](./CLAUDE.md), encrypted fields are *never* surfaced in the dashboard:

| Field | Public? | Why |
| - | - | - |
| `runHash`, `datasetHash`, `storageRootHash`, `attestationHash` | ✅ | On chain; identity of the cert |
| Headline metrics (`totalReturnBps`, `sharpeX1000`, `maxDrawdownBps`, `winRateBps`) | ✅ | On chain; deterministic from trades |
| `trustTier`, `market`, `owner`, `createdAt` | ✅ | On chain |
| Agent `name`, `description`, hyperparams | 🔒 | AES-encrypted in 0G Storage; owner-only |
| Trade-by-trade detail, equity curve | 🔒 | AES-encrypted in 0G Storage; owner-only |
| AES key | 🔒 | Local file at `~/.zeroarena/keys/agent-<tokenId>.key`; never on chain |

The detail page surfaces placeholder values (`Agent #${tokenId}`, deterministic sparkline derived from `runHash` bytes) where the chain doesn't carry display copy.

---

## Deploy

Designed for [Vercel](https://vercel.com). Push to `main` → Vercel auto-build. No env vars required.

For a different host: any Node 22+ runtime that supports Next.js 16 server components works. Make sure the host's outbound network can reach `https://evmrpc-testnet.0g.ai` and `https://chainscan-galileo.0g.ai`.

---

## Coupling rules

- **No `zeroarena` npm dep.** The SDK pulls in Node-only deps (`@0gfoundation/0g-storage-ts-sdk`, signer code) that would bloat the browser bundle. The FE reads chain directly via viem.
- **Mirror `CANONICAL_DATASETS` from SDK.** When the operator re-uploads a dataset via `zero-arena-bacend`, bump `lib/chain/datasets.ts` in lockstep. The SDK's `datasets.ts` is the source of truth.
- **ABIs are inlined.** When `@zero-arena/contracts` npm package ships, swap the parsed inline ABIs in `lib/chain/contracts.ts` for the imported artifact. Until then we copy minimal fragments.

---

## License

MIT.
