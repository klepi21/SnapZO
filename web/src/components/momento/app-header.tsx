"use client";

import { Bell } from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import { SnapInlineIcon } from "@/components/icons/snap-inline-icon";
import { WalletHeaderMenu } from "@/components/wallet/wallet-header-menu";
import { useMezoBalancesReadout } from "@/hooks/use-mezo-balances-readout";

const iconGhost =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-zinc-300 transition hover:text-white active:scale-95";

export function AppHeader() {
  const { native, snapBalance, snapFormatted } = useMezoBalancesReadout();
  const snapLabel = native.isPending || snapBalance.isPending
    ? "…"
    : native.error || snapBalance.error
      ? "—"
      : (snapFormatted ?? "0");

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#080d16]/88 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#080d16]/72">
      <div className="flex min-h-11 items-center justify-between gap-3 px-4 pb-2 pt-[max(0.45rem,env(safe-area-inset-top))]">
        <h1 className="font-snapzo-logo min-w-0 truncate text-xl font-normal leading-none tracking-[0.04em] text-white drop-shadow-[0_1px_14px_rgba(0,0,0,0.45)] sm:text-2xl">
          {APP_NAME}
        </h1>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.12] bg-black/25 px-2.5">
            <SnapInlineIcon size={24} decorative />
            <span className="font-mono text-[11px] font-medium text-zinc-100">
              {snapLabel}
            </span>
          </div>
          <button type="button" className={iconGhost} aria-label="Notifications">
            <Bell className="h-[20px] w-[20px]" strokeWidth={1.5} />
          </button>
          <WalletHeaderMenu />
        </div>
      </div>
    </header>
  );
}
