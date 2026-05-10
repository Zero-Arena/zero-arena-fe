import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
        <header className="border-b border-zinc-900 bg-zinc-950/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-8 px-6 py-3 text-sm">
            <Link href="/" className="font-semibold tracking-tight text-yellow-400">
              ZeroArena
            </Link>
            <nav className="flex items-center gap-5">
              <Link href="/" className="text-zinc-300 hover:text-zinc-100">
                Agents
              </Link>
              <Link href="/leaderboard" className="text-zinc-300 hover:text-zinc-100">
                Leaderboard
              </Link>
              <a
                href="https://github.com/Zero-Arena"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-300 hover:text-zinc-100"
              >
                GitHub
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
