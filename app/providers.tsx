"use client";

// Client-side providers for wagmi + react-query. Mounted once in layout.tsx
// so client components anywhere in the tree can call useReadContract,
// useAccount, etc. Server components keep using viem's publicClient
// directly (see lib/chain/readers.ts) — no provider needed for them.

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
