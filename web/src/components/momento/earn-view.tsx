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
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-black/30 text-white shadow-sm backdrop-blur-md transition active:scale-95 hover:bg-white/10"
            aria-label="Back to feed"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white">Earn</h1>
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
            <p className="mt-1.5 text-sm text-zinc-400">
              MUSD pool ·{" "}
              <span className="inline-flex items-center gap-0 whitespace-nowrap align-middle">
                <SnapInlineIcon decorative />
                {"SNAP receipts"}
              </span>{" "}
              · relayer covers gas
            </p>
          </div>
        </div>
      </div>

      <div className="mx-4 flex flex-col gap-4 sm:gap-5">
        <section
          className="rounded-2xl border border-white/[0.08] bg-zinc-900/45 px-3 py-3 sm:px-4"
          aria-labelledby="earn-hub-section"
        >
          <h2
            id="earn-hub-section"
            className="text-sm font-semibold uppercase tracking-wide text-zinc-300"
          >
            Hub pool (deposit / withdraw)
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Deposit MUSD and mint SNAP receipts. Withdraw burns SNAP and returns MUSD + indexed MEZO
            rewards (minus fee).
          </p>
        </section>
        {hubUi ? (
          <SnapZoHubEarnPanel />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-6 text-center text-sm text-zinc-400">
            Hub UI is off for this build (
            <span className="font-mono text-zinc-500">NEXT_PUBLIC_SNAPZO_HUB_UI</span>).
          </div>
        )}
        <section
          className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] px-3 py-3 sm:px-4"
          aria-labelledby="earn-creator-rewards-section"
        >
          <h2
            id="earn-creator-rewards-section"
            className="text-sm font-semibold uppercase tracking-wide text-sky-200/90"
          >
            Creator rewards (SnapZoRewards)
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-sky-100/70">
            Separate flow: creators claim weekly Merkle-based MEZO rewards from the rewards contract.
            This is independent from hub deposit and withdraw actions.
          </p>
        </section>
        <SnapZoRewardsClaimPanel />
        <EarnVaultStats />
      </div>
    </main>
  );
}
