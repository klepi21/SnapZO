"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Home, PiggyBank, Plus, Search, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

type NavItem =
  | { href: string; label: string; disabled: boolean; Icon: LucideIcon; isCreate?: false }
  | { href: "/onlysnaps"; label: string; disabled: boolean; iconSrc: string; isCreate?: false }
  | { href: "/create"; label: string; disabled: boolean; isCreate: true };

const items: NavItem[] = [
  { href: "/feed", label: "Home", disabled: false, Icon: Home },
  { href: "/leaderboard", label: "Creators", disabled: false, Icon: Search },
  { href: "/create", label: "Create", disabled: false, isCreate: true },
  { href: "/earn", label: "Earn", disabled: false, Icon: PiggyBank },
  { href: "/profile", label: "Profile", disabled: false, Icon: UserRound },
  { href: "/onlysnaps", label: "OnlySnaps", disabled: false, iconSrc: "/snapzo-logo-icon2.png" },
];

function IgCreateIcon({ active }: { active: boolean }) {
  return (
    <span
      className={`snapzo-pressable flex h-[22px] w-[22px] items-center justify-center rounded-full border ${
        active
          ? "border-fuchsia-300/90 bg-fuchsia-500/20 shadow-[0_0_12px_rgba(244,114,182,0.32)]"
          : "border-zinc-500/80 bg-transparent"
      }`}
      aria-hidden
    >
      <Plus
        className={`h-[12px] w-[12px] ${active ? "text-fuchsia-200" : "text-zinc-400"}`}
        strokeWidth={2.4}
      />
    </span>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const [profileWallet, setProfileWallet] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const wallet = new URLSearchParams(window.location.search).get("wallet");
    setProfileWallet(wallet);
  }, [pathname]);
  const profileHref =
    pathname.startsWith("/profile") && profileWallet
      ? `/profile?wallet=${profileWallet}`
      : "/profile";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
      <nav
        aria-label="Main navigation"
        className="pointer-events-auto mx-auto mb-[max(0.4rem,env(safe-area-inset-bottom,0px))] w-[calc(100%-1.2rem)] max-w-[390px] overflow-hidden rounded-[22px] border border-white/[0.12] bg-[#0a1024]/92 px-1.5 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#0a1024]/82"
      >
        <ul className="grid h-[58px] w-full grid-cols-6 place-items-center gap-0.5 px-0.5">
          {items.map((item) => {
            const targetHref = item.href === "/profile" ? profileHref : item.href;
            const active =
              !item.disabled &&
              (pathname === item.href || pathname.startsWith(`${item.href}/`));

            const inner =
              "isCreate" in item && item.isCreate ? (
                <IgCreateIcon active={active} />
              ) : (
                "iconSrc" in item ? (
                  <Image
                    src={item.iconSrc}
                    alt=""
                    width={20}
                    height={20}
                    className={`h-[20px] w-[20px] shrink-0 transition-all ${
                      active ? "scale-[1.02] opacity-100" : "opacity-80"
                    }`}
                  />
                ) : (
                  (() => {
                  const iconSize =
                    item.href === "/profile"
                      ? "h-[20px] w-[20px]"
                      : item.href === "/earn"
                        ? "h-[19px] w-[19px]"
                        : "h-[20px] w-[20px]";
                  const iconStroke =
                    item.href === "/profile" ? (active ? 2.15 : 1.9) : active ? 2.2 : 1.9;
                  return (
                <item.Icon
                  className={`${iconSize} shrink-0 transition-all ${
                    active
                      ? "scale-[1.02] text-fuchsia-300"
                      : "text-zinc-200"
                  }`}
                  strokeWidth={iconStroke}
                  fill={item.href === "/feed" && active ? "currentColor" : "none"}
                />
                  );
                  })()
                )
              );

            const hit = (
              <span
                className={`snapzo-pressable flex h-full w-full max-w-[70px] flex-col items-center justify-center gap-0.5 rounded-xl active:opacity-80 ${
                  active
                    ? "bg-white/[0.03]"
                    : "bg-transparent"
                }`}
              >
                {inner}
                <span
                  className={`text-[9px] font-medium leading-none ${
                    active ? "text-fuchsia-300" : "text-zinc-300"
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
                  href={targetHref}
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
