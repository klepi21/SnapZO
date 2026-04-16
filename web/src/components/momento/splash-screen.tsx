"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MusdInlineIcon } from "@/components/icons/musd-inline-icon";
import { APP_NAME } from "@/lib/brand";
import { isOnboardingComplete } from "@/lib/snapzo-onboarding-local";

const orbitAvatars = [
  { id: 44, size: 56, top: "6%", left: "12%", opacity: 0.95 },
  { id: 65, size: 72, top: "10%", left: "58%", opacity: 1 },
  { id: 12, size: 48, top: "22%", left: "38%", opacity: 0.85 },
  { id: 33, size: 64, top: "28%", left: "8%", opacity: 0.9 },
  { id: 71, size: 52, top: "34%", left: "72%", opacity: 0.88 },
  { id: 5, size: 68, top: "42%", left: "48%", opacity: 1 },
  { id: 22, size: 44, top: "48%", left: "22%", opacity: 0.8 },
  { id: 88, size: 60, top: "18%", left: "78%", opacity: 0.92 },
  { id: 52, size: 50, top: "52%", left: "62%", opacity: 0.85 },
] as const;

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

      <div className="relative flex flex-1 flex-col px-6 pb-10 pt-6">
        <div className="relative mx-auto mt-4 h-[320px] w-full max-w-[340px]">
          {orbitAvatars.map((a) => (
            <div
              key={a.id}
              className="absolute rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.45)] ring-2 ring-white/10"
              style={{
                top: a.top,
                left: a.left,
                width: a.size,
                height: a.size,
                opacity: a.opacity,
              }}
            >
              <Image
                src={`https://picsum.photos/id/${a.id}/${a.size * 2}/${a.size * 2}`}
                alt=""
                width={a.size * 2}
                height={a.size * 2}
                className="h-full w-full rounded-full object-cover"
              />
            </div>
          ))}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full text-white/[0.08]"
            viewBox="0 0 340 320"
            fill="none"
            aria-hidden
          >
            <path
              d="M40 180 Q 120 80 170 100 T 300 160"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M60 220 Q 160 120 280 200"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
        </div>

        <div className="relative z-10 mt-auto text-center">
          <h1 className="text-[2.75rem] font-bold leading-none tracking-tight text-white">
            {APP_NAME}
          </h1>
          <p className="mx-auto mt-4 max-w-[20rem] text-pretty text-sm leading-relaxed text-zinc-400 sm:text-base">
            Unlock premium posts, tip creators, and pay for replies — all with{" "}
            <span className="inline-flex translate-y-[3px] items-center align-middle">
              <MusdInlineIcon size={17} />
            </span>{" "}
            on Mezo.
          </p>
          <Link
            href={startedHref}
            className="mt-10 inline-flex w-full max-w-xs items-center justify-center rounded-full bg-gradient-to-r from-[#3b82f6] via-[#2563eb] to-[#1d4ed8] py-4 text-base font-semibold text-white shadow-[0_12px_40px_rgba(37,99,235,0.45)] transition hover:brightness-110 active:scale-[0.98]"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
