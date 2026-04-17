"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, Home, PiggyBank, Plus, UserRound } from "lucide-react";

const items = [
  { href: "/feed", icon: Home, label: "Home", disabled: false as const, highlight: false as const },
  {
    href: "/leaderboard",
    icon: Crown,
    label: "Leaderboard",
    disabled: false as const,
    highlight: false as const,
  },
  {
    href: "/create",
    icon: Plus,
    label: "New post",
    disabled: false as const,
    highlight: true as const,
  },
  {
    href: "/earn",
    icon: PiggyBank,
    label: "Earn",
    disabled: false as const,
    highlight: false as const,
  },
  { href: "/profile", icon: UserRound, label: "Profile", disabled: false as const, highlight: false as const },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-2">
      <nav
        className="pointer-events-auto flex w-fit max-w-[calc(100vw-1.25rem)] items-center gap-1 overflow-x-auto rounded-full border border-white/80 bg-[linear-gradient(180deg,#ffffff,#eef3ff)] px-2 py-1.5 shadow-[0_10px_34px_rgba(6,10,20,0.32)] backdrop-blur-2xl"
        aria-label="Main navigation"
      >
        {items.map(({ href, icon: Icon, label, disabled, highlight }) => {
          const active =
            !disabled && (pathname === href || pathname.startsWith(`${href}/`));
          const inner = (
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors sm:h-9 sm:w-9 ${
                active
                  ? highlight
                    ? "bg-[radial-gradient(circle_at_30%_30%,#8b5cf6_0%,#3b82f6_45%,#ec4899_100%)] text-white shadow-[0_0_22px_rgba(99,102,241,0.45)]"
                    : "bg-[#111827] text-white shadow-[0_0_14px_rgba(17,24,39,0.25)]"
                  : highlight
                    ? "bg-[radial-gradient(circle_at_30%_30%,#8b5cf6_0%,#3b82f6_45%,#ec4899_100%)] text-white shadow-[0_0_14px_rgba(99,102,241,0.3)]"
                    : "text-zinc-700 hover:bg-black/[0.06] hover:text-zinc-950"
              } ${disabled ? "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-zinc-600" : ""}`}
            >
              <Icon
                className={highlight && !active ? "h-[19px] w-[19px]" : "h-[18px] w-[18px]"}
                strokeWidth={active ? 2 : highlight ? 2.1 : 1.5}
              />
            </span>
          );

          if (disabled) {
            return (
              <span
                key={label}
                className="flex shrink-0"
                title="New post"
              >
                {inner}
              </span>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className="flex shrink-0"
              aria-current={active ? "page" : undefined}
              aria-label={label}
            >
              {inner}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
