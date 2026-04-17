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

/** Intrinsic size for `next/image` (display is capped by viewport). */
const SNAP_HERO_LOGO_PX = 560;

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
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_18%,rgba(59,130,246,0.38),transparent_58%),linear-gradient(180deg,#0a1628_0%,#05070d_45%,#020203_100%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative flex flex-1 flex-col items-center px-6 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center text-center">
          <div className="relative mx-auto flex min-h-[min(52dvh,620px)] w-full max-w-[min(560px,calc(100vw-3rem))] items-center justify-center">
            <div
              className="pointer-events-none absolute inset-[8%] rounded-full bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.22),transparent_62%)] blur-3xl"
              aria-hidden
            />
            <div className="relative rounded-full p-3 shadow-[0_28px_90px_rgba(0,0,0,0.65)] ring-1 ring-white/12 ring-offset-0">
              <Image
                src="/snap-token-logo.png"
                alt="SnapZO"
                width={SNAP_HERO_LOGO_PX}
                height={SNAP_HERO_LOGO_PX}
                priority
                className="aspect-square w-full max-w-[min(560px,calc(100vw-3rem))] rounded-full object-cover"
                sizes="(max-width: 430px) min(382px, 100vw), 560px"
              />
            </div>
          </div>

          <div className="relative z-10 mt-2 w-full max-w-md">
            <h1 className="text-[2.65rem] font-bold leading-[0.95] tracking-tight text-white sm:text-[2.85rem]">
              {APP_NAME}
            </h1>
            <p className="mx-auto mt-3 max-w-[26rem] text-pretty text-base font-semibold leading-snug tracking-tight text-zinc-100 sm:text-lg">
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
            className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#3b82f6] via-[#2563eb] to-[#1d4ed8] py-4 text-base font-semibold text-white shadow-[0_12px_40px_rgba(37,99,235,0.45)] transition hover:brightness-110 active:scale-[0.98]"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
