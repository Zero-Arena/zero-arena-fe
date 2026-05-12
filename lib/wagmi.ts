// Wagmi config — used by the client-side <Providers> wrapper. Server-side
// page data still goes through viem's publicClient (lib/chain/client.ts);
// wagmi is reserved for components that need reactive chain state, wallet
// connection, or transactions (v0.2 territory).

import { http, createConfig } from "wagmi";
import { galileo } from "./chain/galileo";

export const wagmiConfig = createConfig({
  chains: [galileo],
  transports: {
    [galileo.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
