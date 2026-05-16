// viem publicClient for server-side reads.
//
// Lives in a separate module so Next.js can tree-shake — only the readers
// import this. Client components that need reactive chain data should use
// the wagmi hooks (useReadContract / useReadContracts) via `lib/wagmi.ts`,
// not this publicClient directly.

import { createPublicClient, http } from "viem";
import { zerog } from "./zerog";

/**
 * Single shared publicClient for server-side fetches. The 0G mainnet RPC is
 * generous enough that we don't need per-request clients or multicall
 * batching at v0.1 traffic levels.
 */
export const publicClient = createPublicClient({
  chain: zerog,
  transport: http(),
});
