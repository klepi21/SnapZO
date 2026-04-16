"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Home, PiggyBank, Plus, UserRound } from "lucide-react";

const items = [
  { href: "/feed", icon: Home, label: "Home", disabled: false as const, highlight: false as const },
  {
    href: "/swap",
    icon: ArrowLeftRight,
    label: "Swap",
    disabled: false as const,
    highlight: false as const,
  },
  {
    href: "/earn",
    icon: PiggyBank,
    label: "Earn",
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
  { href: "/profile", icon: UserRound, label: "Profile", disabled: false as const, highlight: false as const },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-2">
      <nav
        className="pointer-events-auto flex w-fit max-w-[calc(100vw-1.25rem)] items-center gap-0.5 overflow-x-auto rounded-full border border-white/[0.12] bg-[rgba(8,12,22,0.82)] px-1 py-1 shadow-[0_12px_44px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl"
        aria-label="Main navigation"
      >
        {items.map(({ href, icon: Icon, label, disabled, highlight }) => {
          const active =
            !disabled && (pathname === href || pathname.startsWith(`${href}/`));
          const inner = (
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors sm:h-9 sm:w-9 ${
                active
                  ? "bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white shadow-[0_0_18px_rgba(59,130,246,0.4)]"
                  : highlight
                    ? "text-white ring-1 ring-white/15 ring-offset-0 hover:bg-white/10"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
              } ${disabled ? "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-zinc-400" : ""}`}
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
