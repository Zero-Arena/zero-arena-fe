// Galileo testnet chain definition for viem / wagmi.
//
// chainId 16602 is the canonical 0G Galileo testnet per the contracts repo
// (zero-arena-contracts/README.md). The RPC + explorer URLs match what the
// SDK uses by default — keep them in sync if 0G migrates infrastructure.

import { defineChain } from "viem";

export const galileo = defineChain({
  id: 16602,
  name: "0G Galileo",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
  blockExplorers: {
    default: {
      name: "Galileo Chainscan",
      url: "https://chainscan-galileo.0g.ai",
    },
  },
  testnet: true,
});

/** Block the contracts were deployed at. Used as `fromBlock` when scanning logs. */
export const DEPLOY_BLOCK = 32_563_974n;

/** Convenience: build a Galileo explorer URL for a tx hash or address. */
export function explorerUrl(kind: "tx" | "address" | "token", value: string): string {
  return `${galileo.blockExplorers.default.url}/${kind}/${value}`;
}
