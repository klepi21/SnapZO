"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Sparkles,
  TrendingUp,
  Unlock,
} from "lucide-react";

import { APP_NAME } from "@/lib/brand";
import { isOnboardingComplete } from "@/lib/snapzo-onboarding-local";

/** Natural asset size (PNG with alpha). */
const SNAP_LOGO_WIDTH = 638;
const SNAP_LOGO_HEIGHT = 622;

const STORIES: { seed: string; label: string }[] = [
  { seed: "snapzo-s1", label: "You" },
  { seed: "snapzo-s2", label: "travel" },
  { seed: "snapzo-s3", label: "studio" },
  { seed: "snapzo-s4", label: "night" },
  { seed: "snapzo-s5", label: "food" },
];

function StoryRing({ seed, label }: { seed: string; label: string }) {
  return (
    <div className="flex w-[3.25rem] shrink-0 flex-col items-center gap-1">
      <div className="rounded-full bg-gradient-to-tr from-amber-400 via-fuchsia-500 to-sky-400 p-[2.5px] shadow-[0_0_16px_rgba(56,189,248,0.22)]">
        <div className="h-10 w-10 overflow-hidden rounded-full border border-black/70 bg-zinc-950">
          <Image
            src={`https://picsum.photos/seed/${seed}/112/112`}
            alt=""
            width={112}
            height={112}
            className="h-full w-full object-cover"
            sizes="40px"
          />
        </div>
      </div>
      <span className="max-w-full truncate text-center text-[9px] font-medium text-zinc-500">
        {label}
      </span>
    </div>
  );
}

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
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#11182a]">
              <Image
                src="/snap-token-logo.png"
                alt=""
                width={SNAP_LOGO_WIDTH}
                height={SNAP_LOGO_HEIGHT}
                priority
                className="h-full w-full object-contain p-1"
                sizes="40px"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-white">{APP_NAME}</p>
              <p className="truncate text-[11px] text-zinc-500">Photo feed · Mezo testnet</p>
            </div>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-300/25 bg-sky-400/[0.1] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-sky-100">
            <Sparkles className="h-3 w-3" />
            SNAP
          </div>
        </header>

        <div className="mt-4 text-center">
          <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-zinc-400">
            <Camera className="h-3.5 w-3.5 text-zinc-300" />
            Photo-first · like Instagram
          </div>
          <h1 className="mt-3 text-balance text-2xl font-semibold leading-tight tracking-[-0.03em] text-white">
            Your feed,{" "}
            <span className="bg-gradient-to-r from-sky-200 to-indigo-300 bg-clip-text text-transparent">
              powered by SNAP
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-[24rem] text-balance text-sm leading-relaxed text-zinc-300">
            A photo-first social experience where creators are rewarded, and you earn real yield on
            your assets.
          </p>
          <Link
            href={startedHref}
            className="snapzo-pressable mx-auto mt-4 inline-flex w-full max-w-[220px] items-center justify-center rounded-xl border border-sky-200/35 bg-gradient-to-r from-[#1ea8f1] via-[#2d77f5] to-[#6e34f3] px-4 py-2.5 text-lg font-medium text-white shadow-[0_14px_42px_rgba(37,99,235,0.45),0_0_22px_rgba(56,189,248,0.28)] hover:brightness-110 active:scale-[0.985]"
          >
            Open feed
          </Link>
          <p className="mt-2 text-center text-[10px] text-zinc-600">Demo photos · not your uploads</p>
        </div>

        <section
          className="mt-4 overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#0a0f1a]/80 shadow-[0_14px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]"
          aria-label="Value proposition"
        >
          <div className="grid grid-cols-2 gap-0">
            <div className="flex gap-2 p-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-pink-300/30 bg-pink-500/[0.08]">
                <Heart className="h-4 w-4 text-pink-400" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100">Creators get rewarded</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-300">
                  from micro-SNAP likes, unlocks & replies-real support without heavy spending.
                </p>
              </div>
            </div>
            <div className="flex gap-2 border-l border-white/[0.08] p-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-500/[0.08]">
                <TrendingUp className="h-4 w-4 text-emerald-400" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100">You still earn real yield</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-300">
                  on your money in the Earn hub-stack MUSD, scroll the feed, stay on-chain.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="mt-2 overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#0a0f1a]/80 px-3 py-2.5 shadow-[0_14px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]"
          aria-label="Stories preview"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Stories
            </p>
            <button
              type="button"
              className="snapzo-pressable inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              View all
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STORIES.map((s) => (
              <StoryRing key={s.seed} seed={s.seed} label={s.label} />
            ))}
          </div>
        </section>

        <section
          className="mt-2 overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#0a0f1a]/80 p-2 shadow-[0_14px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]"
          aria-label="Featured post preview"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="flex min-w-0 items-center gap-2">
              <div className="h-8 w-8 overflow-hidden rounded-full ring-1 ring-white/[0.2]">
                <Image
                  src="https://picsum.photos/seed/snapzo-avatar/80/80"
                  alt=""
                  width={32}
                  height={32}
                  className="h-full w-full object-cover"
                  sizes="32px"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">
                  Featured creator post{" "}
                  <CheckCircle2 className="mb-0.5 inline h-3.5 w-3.5 text-sky-300" />
                </p>
                <p className="text-[11px] text-zinc-500">2h ago</p>
              </div>
            </div>
            <button
              type="button"
              className="snapzo-pressable flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
          <div className="relative aspect-[16/8] w-full overflow-hidden rounded-xl ring-1 ring-white/[0.06]">
            <Image
              src="https://picsum.photos/seed/snapzo-featured/900/420"
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 430px) 100vw, 420px"
              priority
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/15" />
            <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                <Heart className="h-3.5 w-3.5 text-red-400" fill="currentColor" />
                1.2K
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                <MessageCircle className="h-3.5 w-3.5" />
                128
              </span>
            </div>
          </div>
        </section>

        <div className="mt-2 grid grid-cols-3 overflow-hidden rounded-[16px] border border-white/[0.08] bg-[#0a0f1a]/80 shadow-[0_14px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="px-2 py-2 text-center">
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-100">
              <Heart className="h-4 w-4 text-violet-400" />
              12.5K
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">Likes</p>
          </div>
          <div className="border-x border-white/[0.08] px-2 py-2 text-center">
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-100">
              <Unlock className="h-4 w-4 text-indigo-300" />
              3.2K
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">Unlocks</p>
          </div>
          <div className="px-2 py-2 text-center">
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-100">
              <MessageCircle className="h-4 w-4 text-emerald-300" />
              8.7K
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">Replies</p>
          </div>
        </div>
      </div>
    </div>
  );
}
