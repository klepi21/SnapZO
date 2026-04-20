"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Home, PiggyBank, Plus, Search, UserRound } from "lucide-react";

type NavItem =
  | { href: string; label: string; disabled: boolean; Icon: LucideIcon; isCreate?: false }
  | { href: "/create"; label: string; disabled: boolean; isCreate: true };

const items: NavItem[] = [
  { href: "/feed", label: "Home", disabled: false, Icon: Home },
  { href: "/leaderboard", label: "Leaderboard", disabled: false, Icon: Search },
  { href: "/create", label: "New post", disabled: false, isCreate: true },
  { href: "/earn", label: "Earn", disabled: false, Icon: PiggyBank },
  { href: "/profile", label: "Profile", disabled: false, Icon: UserRound },
];

function IgCreateIcon({ active }: { active: boolean }) {
  return (
    <span
      className={`flex h-[26px] w-[26px] items-center justify-center rounded-[5px] border-[2.25px] transition-colors ${
        active ? "border-white" : "border-zinc-500"
      }`}
      aria-hidden
    >
      <Plus
        className={`h-[15px] w-[15px] ${active ? "text-white" : "text-zinc-400"}`}
        strokeWidth={2.75}
      />
    </span>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
      <nav
        aria-label="Main navigation"
        className="pointer-events-auto mx-auto w-full max-w-[430px] overflow-hidden rounded-t-3xl border border-white/[0.08] border-b-0 bg-[#080d16]/92 pt-2 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] shadow-[0_-12px_40px_rgba(0,0,0,0.28)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#080d16]/78"
      >
        <ul className="grid h-12 w-full grid-cols-5 place-items-center px-1 sm:px-2">
          {items.map((item) => {
            const active =
              !item.disabled &&
              (pathname === item.href || pathname.startsWith(`${item.href}/`));

            const inner =
              "isCreate" in item && item.isCreate ? (
                <IgCreateIcon active={active} />
              ) : (
                <item.Icon
                  className={`h-[26px] w-[26px] shrink-0 transition-colors ${
                    active ? "text-white" : "text-zinc-500"
                  }`}
                  strokeWidth={active ? 2.35 : 2}
                  fill={item.href === "/feed" && active ? "currentColor" : "none"}
                />
              );

            const hit = (
              <span className="flex h-full w-full max-w-[72px] items-center justify-center active:opacity-80">
                {inner}
              </span>
            );

            if (item.disabled) {
              return (
                <li
                  key={item.label}
                  className="flex h-full min-h-[48px] w-full items-center justify-center"
                >
                  <span className="cursor-not-allowed opacity-35" title={item.label}>
                    {hit}
                  </span>
                </li>
              );
            }

            return (
              <li
                key={item.href}
                className="flex h-full min-h-[48px] w-full items-center justify-center"
              >
                <Link
                  href={item.href}
                  className="flex h-full w-full items-center justify-center"
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                >
                  {hit}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
