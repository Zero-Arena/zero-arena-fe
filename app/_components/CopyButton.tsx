"use client";

// Tiny copy-to-clipboard button. Reusable across the dashboard (currently
// the Reproducer card on agent detail; will be useful for runHash etc.).
//
// Uses the async Clipboard API and falls back silently on browsers that
// reject the call (e.g. iframes without permission). The "Copied!" badge
// stays for 1.5s so the user sees feedback even on instant successes.

import { useState } from "react";

export default function CopyButton({
  text,
  className = "",
  label = "Copy",
}: {
  text: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Most likely a permissions denial — silent failure is OK at v0.1.
    }
  }

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100 ${className}`}
      title={copied ? "Copied" : "Copy to clipboard"}
      aria-label="Copy"
    >
      {copied ? (
        <>
          <svg className="size-3 text-emerald-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2.5 6.2L4.8 8.5 9.5 3.5" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="5" y="5" width="9" height="9" rx="1.5" />
            <path d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
