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
import { APP_CREATOR_REVENUE_EXPLAINER, APP_NAME } from "@/lib/brand";
import { markOnboardingComplete } from "@/lib/snapzo-onboarding-local";

const steps = [
  {
    key: "intro",
    title: `Welcome to ${APP_NAME}`,
    icon: Sparkles,
    body: [
      "SnapZo is a social feed on Mezo testnet: share photos, optional paid unlocks, and creator support — powered by a SNAP economy on the feed and MUSD in the Earn hub.",
      "Fans use SNAP for likes, replies, and unlocks. SNAP comes from depositing MUSD into the SnapZo hub, where principal tracks Mezo yield strategies.",
    ],
  },
  {
    key: "tokens",
    title: "SNAP on the feed, MUSD in the hub",
    icon: Wallet,
    body: [
      "SNAP is your in-app share token: transfer it to tip, comment, or unlock just like any ERC-20 — creators receive SNAP directly.",
      "MUSD is Mezo’s Bitcoin-backed stablecoin. Deposit MUSD on Earn to mint SNAP; withdraw later for MUSD. You always sign transfers in your own wallet.",
    ],
  },
  {
    key: "earn",
    title: "How creators earn",
    icon: Coins,
    body: [
      "Fans pay you in SNAP on the feed — tips, unlocks, and paid replies all land as SNAP in your wallet.",
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
      "Nothing here mints NFTs for your photos by default — normal uploads plus transparent SNAP prices you control.",
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
    <div className="relative flex min-h-dvh w-full max-w-[430px] flex-col bg-black">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_18%,rgba(59,130,246,0.38),transparent_58%),linear-gradient(180deg,#0a1628_0%,#05070d_45%,#020203_100%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px]" />

      <header className="relative z-10 flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {index > 0 ? (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white backdrop-blur-md transition hover:bg-white/10"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
        ) : (
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white backdrop-blur-md transition hover:bg-white/10"
            aria-label="Back to welcome"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
        )}
        <button
          type="button"
          onClick={finish}
          className="text-sm font-medium text-zinc-400 transition hover:text-white"
        >
          Skip
        </button>
      </header>

      <div className="relative z-10 flex flex-1 flex-col px-6 pb-10 pt-2">
        <div className="flex justify-center gap-2 py-4" aria-hidden>
          {steps.map((_, i) => (
            <span
              key={steps[i].key}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? "w-8 bg-gradient-to-r from-blue-400 to-indigo-500"
                  : "w-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>

        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/25 to-violet-600/20 shadow-[0_0_40px_rgba(59,130,246,0.2)]">
          <Icon className="h-11 w-11 text-indigo-200/95" strokeWidth={1.35} />
        </div>

        <h1 className="text-center text-2xl font-bold leading-tight tracking-tight text-white sm:text-[1.65rem]">
          {step.title}
        </h1>

        <div className="mt-6 flex flex-1 flex-col gap-4 text-pretty text-center text-sm leading-relaxed text-zinc-400 sm:text-base">
          {step.body.map((para, pi) => (
            <p key={pi}>{para}</p>
          ))}
        </div>

        <div className="mt-auto space-y-4 pt-6">
          {isLast ? (
            <button
              type="button"
              onClick={finish}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#3b82f6] via-[#2563eb] to-[#1d4ed8] py-4 text-base font-semibold text-white shadow-[0_12px_40px_rgba(37,99,235,0.45)] transition hover:brightness-110 active:scale-[0.98]"
            >
              Enter {APP_NAME}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#3b82f6] via-[#2563eb] to-[#1d4ed8] py-4 text-base font-semibold text-white shadow-[0_12px_40px_rgba(37,99,235,0.45)] transition hover:brightness-110 active:scale-[0.98]"
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
