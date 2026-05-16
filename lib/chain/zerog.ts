// 0G Mainnet chain definition for viem / wagmi.
//
// chainId 16661 is 0G Mainnet
// (https://docs.0g.ai/developer-hub/mainnet/mainnet-overview). RPC defaults to
// the canonical 0G EVM endpoint; override with NEXT_PUBLIC_ZEROG_RPC_URL when
// targeting a different node (e.g., QuickNode / Ankr).

import { defineChain } from "viem";

const RPC_URL =
  process.env.NEXT_PUBLIC_ZEROG_RPC_URL?.trim() || "https://evmrpc.0g.ai";

export const zerog = defineChain({
  id: 16661,
  name: "0G Mainnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: {
      name: "0G Chainscan",
      url: "https://chainscan.0g.ai",
    },
  },
});

// Block the v0.2 contracts were deployed at on 0G Mainnet. Used as `fromBlock`
// when scanning logs — set to 0n until the mainnet deploy is recorded.
// TODO(mainnet): replace with the actual deployment block to avoid scanning
// the entire chain history on every page load.
export const DEPLOY_BLOCK = BigInt(0);

/** Convenience: build a 0G explorer URL for a tx hash or address. */
export function explorerUrl(kind: "tx" | "address" | "token", value: string): string {
  return `${zerog.blockExplorers.default.url}/${kind}/${value}`;
}
