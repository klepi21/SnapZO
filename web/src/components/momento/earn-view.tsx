"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MusdInlineIcon } from "@/components/icons/musd-inline-icon";
import { EarnVaultStats } from "@/components/momento/earn-vault-stats";
import { SnapZoHubEarnPanel } from "@/components/momento/snapzo-hub-earn-panel";
import { isSnapZoHubConfigured } from "@/lib/constants/snapzo-hub";
import { APP_CREATOR_REVENUE_ONE_LINER } from "@/lib/brand";

export function EarnView() {
  const hubUi = isSnapZoHubConfigured();
  return (
    <main className="pb-32 pt-5">
      <div className="mb-6 flex items-start gap-3 px-4">
        <Link
          href="/feed"
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-black/30 text-white shadow-sm backdrop-blur-md transition active:scale-95 hover:bg-white/10"
          aria-label="Back to feed"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Earn</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
            <span className="inline-flex items-center gap-1 align-middle">
              Deposit
              <MusdInlineIcon size={14} className="shrink-0 rounded-full object-cover" />
              <span className="font-medium text-zinc-300">MUSD</span>
            </span>{" "}
            into the pooled strategy and receive{" "}
            <span className="font-medium text-zinc-300">SNAP</span>. You approve once, sign a
            message, and a relayer pays gas to complete the tx.
          </p>
          <p className="mt-3 rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2.5 text-xs leading-relaxed text-zinc-400">
            <span className="font-medium text-violet-200/95">Creators:</span>{" "}
            {APP_CREATOR_REVENUE_ONE_LINER} Redeem SNAP here when you want MUSD in your wallet.
          </p>
        </div>
      </div>

      <div className="mx-4 flex flex-col gap-5">
        {hubUi ? (
          <SnapZoHubEarnPanel />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-6 text-center text-sm text-zinc-400">
            Pool earn is turned off for this environment (
            <span className="font-mono text-zinc-500">NEXT_PUBLIC_SNAPZO_HUB_UI</span>
            ).
          </div>
        )}
        <EarnVaultStats />
      </div>
    </main>
  );
}
