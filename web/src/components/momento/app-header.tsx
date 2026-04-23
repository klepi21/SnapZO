"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell } from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import { SnapInlineIcon } from "@/components/icons/snap-inline-icon";
import { WalletHeaderMenu } from "@/components/wallet/wallet-header-menu";
import { useMezoBalancesReadout } from "@/hooks/use-mezo-balances-readout";

const iconGhost =
  "snapzo-pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] p-0 text-zinc-300 hover:border-fuchsia-300/35 hover:bg-fuchsia-400/10 hover:text-white active:scale-95";

export function AppHeader() {
  const { isConnected, native, snapBalance, snapFormatted } = useMezoBalancesReadout();
  const snapLabel = native.isPending || snapBalance.isPending
    ? "…"
    : native.error || snapBalance.error
      ? "—"
      : (snapFormatted ?? "0");
  const isZeroSnap =
    Boolean(isConnected) &&
    !native.isPending &&
    !snapBalance.isPending &&
    !native.error &&
    !snapBalance.error &&
    snapBalance.data !== undefined &&
    snapBalance.data <= BigInt(0);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.12] bg-[#0f1530]/86 shadow-[0_12px_32px_rgba(0,0,0,0.28)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#0f1530]/72">
      <div className="flex min-h-11 items-center justify-between gap-3 px-4 pb-2 pt-[max(0.45rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-white/12 bg-white/[0.06]">
            <Image
              src="/snap-token-logo.png"
              alt={`${APP_NAME} icon`}
              fill
              className="object-contain p-1"
              sizes="32px"
            />
          </div>
          <h1 className="font-snapzo-logo snapzo-title-tight min-w-0 truncate text-xl font-normal tracking-[0.04em] text-white drop-shadow-[0_1px_14px_rgba(0,0,0,0.45)] sm:text-2xl">
            {APP_NAME}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isZeroSnap ? (
            <Link
              href="/earn"
              className="snapzo-pressable inline-flex min-h-10 items-center gap-1 rounded-full border border-fuchsia-300/45 bg-fuchsia-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-fuchsia-100 shadow-[0_8px_20px_rgba(0,0,0,0.24)] hover:bg-fuchsia-500/24"
            >
              <SnapInlineIcon decorative />
              Get SNAP
            </Link>
          ) : (
            <div className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-violet-300/25 bg-violet-500/[0.12] px-2.5 py-0.5 shadow-[0_8px_20px_rgba(0,0,0,0.24)]">
              <SnapInlineIcon decorative />
              <span className="font-mono text-[11px] font-medium text-zinc-100">
                {snapLabel} SNAP
              </span>
            </div>
          )}
          <button type="button" className={iconGhost} aria-label="Notifications">
            <Bell className="h-[20px] w-[20px]" strokeWidth={1.5} />
          </button>
          <WalletHeaderMenu />
        </div>
      </div>
    </header>
  );
}
