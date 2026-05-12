"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links: {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
}[] = [
  {
    href: "/",
    label: "Agents",
    isActive: (p) => p === "/" || (p.startsWith("/agent") && !p.includes("/live")),
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    isActive: (p) => p.startsWith("/leaderboard"),
  },
  {
    href: "/season",
    label: "Seasons",
    isActive: (p) => p.startsWith("/season") || p.includes("/live"),
  },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-5">
      {links.map(({ href, label, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 pb-0.5 transition ${
              active
                ? "border-yellow-400 text-zinc-100 font-medium"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
