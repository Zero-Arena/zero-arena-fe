import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "./_components/Nav";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zero Arena — Copy Trading",
  description: "Track top traders and copy their portfolios.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-900 bg-zinc-950/90 backdrop-blur fixed top-0 z-50 w-full">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-8 px-6 py-3 text-sm">
            <Link
              href="/"
              className="font-semibold tracking-tight text-yellow-400"
            >
              ZeroArena
            </Link>
            <Nav />
          </div>
        </header>
        <main className="flex-1 my-10">
          <Providers>{children}</Providers>
        </main>
        <footer className="border-t border-zinc-900 bg-zinc-950/90 backdrop-blur fixed bottom-0 z-50 w-full">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-8 px-6 py-3 text-sm">
            <p className="text-[11px] text-zinc-500">
              Demo data on 0G Galileo testnet. Trust tier T1 = on-chain
              commitment, T2 = owner-shared reproducibility, T3 = TEE-attested
              via 0G Compute Sealed Inference (v0.2).
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
