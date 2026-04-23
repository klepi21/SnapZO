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
      className={`snapzo-pressable flex h-[28px] w-[28px] items-center justify-center rounded-[6px] border-[2.25px] ${
        active
          ? "border-fuchsia-200/95 bg-fuchsia-400/[0.14] shadow-[0_0_0_1px_rgba(251,207,232,0.3),0_0_18px_rgba(244,114,182,0.4)]"
          : "border-zinc-500/90 bg-transparent"
      }`}
      aria-hidden
    >
      <Plus
        className={`h-[15px] w-[15px] ${active ? "text-fuchsia-50" : "text-zinc-400"}`}
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
        className="pointer-events-auto mx-auto w-full max-w-[430px] overflow-hidden rounded-t-3xl border border-white/[0.12] border-b-0 bg-[#0d1330]/92 pt-2 pb-[max(0.45rem,env(safe-area-inset-bottom,0px))] shadow-[0_-12px_40px_rgba(0,0,0,0.3)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#0d1330]/78"
      >
        <div className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-fuchsia-300/45 to-transparent" />
        <ul className="grid h-[62px] w-full grid-cols-5 place-items-center px-1 sm:px-2">
          {items.map((item) => {
            const active =
              !item.disabled &&
              (pathname === item.href || pathname.startsWith(`${item.href}/`));

            const inner =
              "isCreate" in item && item.isCreate ? (
                <IgCreateIcon active={active} />
              ) : (
                (() => {
                  const iconSize =
                    item.href === "/profile"
                      ? "h-[25px] w-[25px]"
                      : item.href === "/earn"
                        ? "h-[24px] w-[24px]"
                        : "h-[26px] w-[26px]";
                  const iconStroke =
                    item.href === "/profile" ? (active ? 2.25 : 1.95) : active ? 2.35 : 2;
                  return (
                <item.Icon
                  className={`${iconSize} shrink-0 transition-all ${
                    active
                      ? "scale-[1.04] text-fuchsia-100 drop-shadow-[0_0_10px_rgba(244,114,182,0.52)]"
                      : "text-zinc-500"
                  }`}
                  strokeWidth={iconStroke}
                  fill={item.href === "/feed" && active ? "currentColor" : "none"}
                />
                  );
                })()
              );

            const hit = (
              <span
                className={`snapzo-pressable flex h-full w-full max-w-[72px] flex-col items-center justify-center gap-0.5 rounded-xl active:opacity-80 ${
                  active
                    ? "bg-gradient-to-b from-fuchsia-300/[0.24] to-violet-500/[0.1] shadow-[inset_0_1px_0_rgba(251,207,232,0.22),0_0_16px_rgba(217,70,239,0.2)]"
                    : "bg-transparent"
                }`}
              >
                {inner}
                <span
                  className={`text-[10px] font-medium leading-none tracking-wide ${
                    active ? "text-fuchsia-100" : "text-zinc-500"
                  }`}
                >
                  {item.label}
                </span>
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
