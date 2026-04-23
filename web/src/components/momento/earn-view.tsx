"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MusdInlineIcon } from "@/components/icons/musd-inline-icon";
import { SnapInlineIcon } from "@/components/icons/snap-inline-icon";
import { EarnVaultStats } from "@/components/momento/earn-vault-stats";
import { SnapZoHubEarnPanel } from "@/components/momento/snapzo-hub-earn-panel";
import { SnapZoRewardsClaimPanel } from "@/components/momento/snapzo-rewards-claim-panel";
import { HelpPopover } from "@/components/ui/help-popover";
import { isSnapZoHubConfigured } from "@/lib/constants/snapzo-hub";

export function EarnView() {
  const hubUi = isSnapZoHubConfigured();
  return (
    <main className="mx-auto max-w-lg pb-32 pt-5 sm:max-w-xl">
      <div className="mb-6 px-4">
        <div className="flex items-start gap-3">
          <Link
            href="/feed"
            className="snapzo-pressable mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] text-white shadow-sm backdrop-blur-md active:scale-95 hover:border-fuchsia-300/35 hover:bg-fuchsia-500/10"
            aria-label="Back to feed"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-[1.7rem] font-semibold tracking-[-0.015em] text-white">Earn</h1>
              <HelpPopover label="About this page">
                <p>
                  <strong>Pool.</strong> Deposit{" "}
                  <span className="inline-flex items-center gap-0.5 align-middle">
                    <MusdInlineIcon className="shrink-0 rounded-full object-cover" />
                    MUSD
                  </span>{" "}
                  into the SnapZo hub; you receive{" "}
                  <span className="inline-flex items-center gap-0 align-middle">
                    <SnapInlineIcon decorative />
                    {"SNAP (18 decimals). "}
                  </span>
                  Mint size follows the vault MUSD→sMUSD rate on that deposit.
                </p>
                <p>
                  <strong>Gasless.</strong> You approve once, sign an EIP-712 message, and a relayer
                  submits the transaction (you still need test BTC for unrelated txs).
                </p>
                <p>
                  <strong>Creators.</strong> On the feed, prices show in MUSD; wallets send the
                  matching{" "}
                  <span className="inline-flex items-center gap-0 align-middle">
                    <SnapInlineIcon decorative />
                    {"SNAP at the live hub ratio. "}
                  </span>
                  Redeem{" "}
                  <span className="inline-flex items-center gap-0 align-middle">
                    <SnapInlineIcon decorative />
                    {"SNAP here for MUSD when you want."}
                  </span>
                </p>
              </HelpPopover>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-4 flex flex-col gap-4 sm:gap-5">
        {hubUi ? (
          <div className="space-y-2">
            <p className="px-1 text-[11px] font-medium text-zinc-400">Pool actions settle through a relayer.</p>
            <SnapZoHubEarnPanel />
          </div>
        ) : (
          <div className="snapzo-card-compact rounded-2xl px-4 py-6 text-center text-sm text-zinc-300">
            Hub UI is off for this build (
            <span className="font-mono text-zinc-500">NEXT_PUBLIC_SNAPZO_HUB_UI</span>).
          </div>
        )}
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-medium text-zinc-400">Creators claim indexed rewards in one tap.</p>
          <SnapZoRewardsClaimPanel />
        </div>
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-medium text-zinc-400">Live hub stats pulled from on-chain reads.</p>
          <EarnVaultStats />
        </div>
      </div>
    </main>
  );
}
