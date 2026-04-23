"use client";

import Image from "next/image";
import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import { SnapInlineIcon } from "@/components/icons/snap-inline-icon";
import { WalletHeaderMenu } from "@/components/wallet/wallet-header-menu";
import { useMezoBalancesReadout } from "@/hooks/use-mezo-balances-readout";

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
        <div className="min-w-0">
          <Image
            src="/snapfull.png"
            alt={`${APP_NAME} logo`}
            width={260}
            height={54}
            priority
            className="h-auto w-[170px] object-contain sm:w-[200px]"
            sizes="(max-width: 640px) 170px, 200px"
          />
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
          <WalletHeaderMenu />
        </div>
      </div>
    </header>
  );
}
