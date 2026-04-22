"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Coins, MessageCircleMore, ShieldCheck, Sparkles, Unlock } from "lucide-react";
import {
  APP_NAME,
} from "@/lib/brand";
import { isOnboardingComplete } from "@/lib/snapzo-onboarding-local";

/** Natural asset size (PNG with alpha). Display scales up to ~2× prior hero cap via max-* below. */
const SNAP_LOGO_WIDTH = 638;
const SNAP_LOGO_HEIGHT = 622;

export function SplashScreen() {
  const [startedHref, setStartedHref] = useState("/onboarding");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- CTA href from localStorage after mount (server defaults to onboarding) */
    if (isOnboardingComplete()) {
      setStartedHref("/feed");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  return (
    <div className="relative flex min-h-dvh w-full max-w-[430px] flex-col bg-[#05070d]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_78%_44%_at_50%_6%,rgba(56,189,248,0.34),transparent_62%),radial-gradient(ellipse_90%_52%_at_50%_56%,rgba(37,99,235,0.2),transparent_72%),linear-gradient(180deg,#0a1020_0%,#070b15_42%,#04050a_100%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative z-10 flex flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/25 bg-sky-400/[0.12] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-100">
            <Sparkles className="h-3.5 w-3.5" />
            Mezo Social
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-zinc-300">
            Gasless UX
          </span>
        </header>

        <section className="mt-5 rounded-[28px] border border-white/[0.09] bg-gradient-to-b from-[#0d1425]/96 to-[#090d17]/92 px-4 py-5 shadow-[0_20px_56px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-sky-200/20 bg-[#11182a]">
              <Image
                src="/snap-token-logo.png"
                alt="SnapZO logo"
                width={SNAP_LOGO_WIDTH}
                height={SNAP_LOGO_HEIGHT}
                priority
                className="h-full w-full object-contain p-1.5"
                sizes="56px"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-sky-200/85">
                {APP_NAME}
              </p>
              <h1 className="mt-0.5 text-balance text-[1.5rem] font-semibold leading-[1.12] tracking-[-0.02em] text-white">
                Get paid when people engage with your content.
              </h1>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-zinc-300">
            Social app on Mezo where every like, unlock, and paid comment is real on-chain value in
            SNAP.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">Like</p>
              <p className="mt-1 text-sm font-semibold text-white">0.01 SNAP</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">Reply</p>
              <p className="mt-1 text-sm font-semibold text-white">0.05 SNAP</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">Unlock</p>
              <p className="mt-1 text-sm font-semibold text-white">Creator set</p>
            </div>
          </div>
        </section>

        <section className="mt-3 space-y-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3">
            <div className="flex items-start gap-2.5">
              <Coins className="mt-0.5 h-4.5 w-4.5 shrink-0 text-sky-300" />
              <div>
                <p className="text-sm font-semibold text-white">Attention becomes earnings</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  Earn from likes, unlocks, and paid replies - no vanity engagement.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3">
            <div className="flex items-start gap-2.5">
              <MessageCircleMore className="mt-0.5 h-4.5 w-4.5 shrink-0 text-sky-300" />
              <div>
                <p className="text-sm font-semibold text-white">Paid comments, quality responses</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  Users can pay to comment. Creators reply to unlock payouts.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-sky-300" />
              <div>
                <p className="text-sm font-semibold text-white">Backed by contracts + database</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  Social actions are tracked in the backend and settled through SnapZo contracts.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-400/[0.06] px-3 py-2.5 text-xs text-sky-100/90">
          <p className="inline-flex items-center gap-1.5 font-medium">
            <Unlock className="h-3.5 w-3.5" />
            Creators monetize content directly with transparent on-chain flows.
          </p>
        </div>

        <div className="mt-auto pt-4">
          <Link
            href={startedHref}
            className="snapzo-pressable inline-flex w-full items-center justify-center rounded-2xl border border-sky-200/35 bg-gradient-to-r from-[#38bdf8] via-[#2563eb] to-[#1d4ed8] py-3.5 text-base font-semibold text-white shadow-[0_14px_42px_rgba(37,99,235,0.45),0_0_22px_rgba(56,189,248,0.28)] hover:brightness-110 active:scale-[0.985]"
          >
            Enter SnapZo
          </Link>
          <p className="mt-2.5 text-center text-[11px] text-zinc-500">
            Built for creators on Mezo testnet
          </p>
        </div>
      </div>
    </div>
  );
}
