"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  APP_NAME,
  APP_SPLASH_BODY,
  APP_SPLASH_HEADLINE,
  APP_SPLASH_TAGLINE,
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
    <div className="relative flex min-h-dvh w-full max-w-[430px] flex-col bg-black">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_16%,rgba(56,189,248,0.28),transparent_58%),radial-gradient(ellipse_72%_45%_at_50%_62%,rgba(37,99,235,0.16),transparent_68%),linear-gradient(180deg,#091327_0%,#05070d_43%,#020203_100%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative flex flex-1 flex-col items-center px-6 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center text-center">
          <div className="relative mx-auto flex min-h-[min(58dvh,900px)] w-full max-w-[min(1120px,calc(100vw-2rem))] items-center justify-center px-1">
            <div
              className="pointer-events-none absolute inset-[5%] bg-[radial-gradient(ellipse_70%_50%_at_50%_45%,rgba(255,255,255,0.18),transparent_70%)] blur-3xl"
              aria-hidden
            />
            <Image
              src="/snap-token-logo.png"
              alt="SnapZO"
              width={SNAP_LOGO_WIDTH}
              height={SNAP_LOGO_HEIGHT}
              priority
              className="relative z-10 h-auto w-full max-w-[min(1120px,calc(100vw-2rem))] max-h-[min(46vmin,380px)] bg-transparent object-contain drop-shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
              sizes="(max-width: 430px) 96vw, 1120px"
            />
          </div>

          <div className="relative z-10 mt-2 w-full max-w-md">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-400/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-100/90">
              Built on Mezo
            </div>
            <h1 className="snapzo-title-tight mt-3 text-[2.75rem] font-bold text-white sm:text-[2.95rem]">
              {APP_NAME}
            </h1>
            <p className="mx-auto mt-3 max-w-[26rem] text-pretty text-base font-semibold leading-snug tracking-[-0.01em] text-zinc-100 sm:text-lg">
              {APP_SPLASH_HEADLINE}
            </p>
            <p className="mx-auto mt-3 max-w-[26rem] text-pretty text-sm leading-relaxed text-zinc-400 sm:text-[0.95rem]">
              {APP_SPLASH_TAGLINE}
            </p>
            <p className="mx-auto mt-4 max-w-[26rem] text-pretty text-xs leading-relaxed text-zinc-500 sm:text-sm">
              {APP_SPLASH_BODY}
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-auto w-full max-w-xs pb-[env(safe-area-inset-bottom)]">
          <Link
            href={startedHref}
            className="snapzo-pressable inline-flex w-full items-center justify-center rounded-full border border-sky-200/35 bg-gradient-to-r from-[#38bdf8] via-[#2563eb] to-[#1d4ed8] py-4 text-base font-semibold text-white shadow-[0_12px_40px_rgba(37,99,235,0.45),0_0_22px_rgba(56,189,248,0.28)] hover:brightness-110 active:scale-[0.98]"
          >
            Get Started
          </Link>
          <p className="mt-3 text-center text-[11px] text-zinc-500">
            Gasless hub actions · Mobile-first social UX
          </p>
        </div>
      </div>
    </div>
  );
}
