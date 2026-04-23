"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronLeft,
  Coins,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useCallback, useState } from "react";
import {
  APP_CREATOR_REVENUE_EXPLAINER,
  APP_NAME,
  APP_SPLASH_BODY,
} from "@/lib/brand";
import { markOnboardingComplete } from "@/lib/snapzo-onboarding-local";

const steps = [
  {
    key: "intro",
    title: `Welcome to ${APP_NAME}`,
    icon: Sparkles,
    body: [
      APP_SPLASH_BODY,
      "SNAP is an 18-decimal hub token minted 1:1 with sMUSD wei the vault assigns on your deposit (so 100 MUSD can become ~500 SNAP if the vault mints ~500 sMUSD). Tips and unlocks send SNAP at the live hub NAV so the quoted MUSD value clears on-chain.",
    ],
  },
  {
    key: "tokens",
    title: "SNAP on the feed, MUSD in the hub",
    icon: Wallet,
    body: [
      "You always sign ERC-20 transfers in your wallet: for social actions that means sending SNAP, even when the UI shows a MUSD price.",
      "MUSD is Mezo’s Bitcoin-backed stablecoin. Deposit MUSD on Earn to mint SNAP (18d, tied to sMUSD); withdraw later for MUSD plus pooled yield.",
    ],
  },
  {
    key: "earn",
    title: "How creators earn",
    icon: Coins,
    body: [
      "Fans see MUSD quotes; tips, unlocks, and paid replies settle as SNAP in your wallet at the hub ratio.",
      APP_CREATOR_REVENUE_EXPLAINER,
      "If you keep SNAP instead of redeeming to MUSD right away, your balance stays in the same yield-bearing pool — more upside over time versus immediately cashing out.",
    ],
  },
  {
    key: "go",
    title: "You are set",
    icon: Sparkles,
    body: [
      "Connect your wallet from the feed when you are ready. Explore the demo feed, try create post, and tune your profile.",
      "Nothing here mints NFTs for your photos by default — normal uploads plus transparent MUSD-quoted unlocks you control.",
    ],
  },
] as const;

export function OnboardingFlow() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const Icon = step.icon;
  const isLast = index === steps.length - 1;

  const finish = useCallback(() => {
    markOnboardingComplete();
    router.push("/feed");
  }, [router]);

  return (
    <div className="relative flex min-h-dvh w-full max-w-[430px] flex-col bg-[#070914]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_18%,rgba(255,45,144,0.3),transparent_58%),radial-gradient(ellipse_70%_50%_at_80%_4%,rgba(124,58,237,0.22),transparent_54%),linear-gradient(180deg,#171229_0%,#0b1020_45%,#06080f_100%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px]" />

      <header className="relative z-10 flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {index > 0 ? (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white backdrop-blur-md transition hover:border-fuchsia-300/35 hover:bg-fuchsia-500/10"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
        ) : (
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white backdrop-blur-md transition hover:border-fuchsia-300/35 hover:bg-fuchsia-500/10"
            aria-label="Back to welcome"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
        )}
        <button
          type="button"
          onClick={finish}
          className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-sm font-medium text-zinc-300 transition hover:border-fuchsia-300/35 hover:bg-fuchsia-500/10 hover:text-white"
        >
          Skip
        </button>
      </header>

      <div className="relative z-10 flex flex-1 flex-col px-6 pb-10 pt-2">
        <div className="mx-auto mb-1">
          <img
            src="/snapfull.png"
            alt={`${APP_NAME} logo`}
            className="h-auto w-[190px] max-w-full object-contain"
          />
        </div>
        <div className="flex justify-center gap-2 py-4" aria-hidden>
          {steps.map((_, i) => (
            <span
              key={steps[i].key}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? "w-8 bg-gradient-to-r from-fuchsia-400 to-violet-500"
                  : "w-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>

        <div className="mx-auto mb-7 flex h-24 w-24 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-500/22 to-violet-600/22 shadow-[0_0_34px_rgba(217,70,239,0.24)]">
          <Icon className="h-11 w-11 text-fuchsia-100/95" strokeWidth={1.35} />
        </div>

        <h1 className="text-center text-[1.95rem] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[2.05rem]">
          {step.title}
        </h1>

        <div className="mt-6 flex flex-1 flex-col gap-3 text-pretty text-center text-sm leading-relaxed text-zinc-300 sm:text-base">
          {step.body.map((para, pi) => (
            <p
              key={pi}
              className="rounded-2xl border border-white/[0.08] bg-[#111933]/72 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
              {para}
            </p>
          ))}
        </div>

        <div className="mt-auto space-y-4 pt-6">
          {isLast ? (
            <button
              type="button"
              onClick={finish}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff2d90] via-[#e140b8] to-[#7c3aed] py-4 text-base font-semibold text-white shadow-[0_12px_40px_rgba(217,70,239,0.35)] transition hover:brightness-110 active:scale-[0.98]"
            >
              Enter {APP_NAME}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff2d90] via-[#e140b8] to-[#7c3aed] py-4 text-base font-semibold text-white shadow-[0_12px_40px_rgba(217,70,239,0.35)] transition hover:brightness-110 active:scale-[0.98]"
            >
              Next
              <ArrowRight className="h-5 w-5" strokeWidth={2} />
            </button>
          )}
          <p className="text-center text-[11px] font-normal text-zinc-600">
            Mezo testnet · SNAP + MUSD · Demo product
          </p>
        </div>
      </div>
    </div>
  );
}
