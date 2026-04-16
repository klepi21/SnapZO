"use client";

import Image from "next/image";
import Link from "next/link";
import { BarChart3, ChevronLeft, Settings, Share2, UserPen } from "lucide-react";
import { useState } from "react";
import { DUMMY_PROFILE, picsumAvatar, picsumPost } from "@/lib/dummy/social";

export function ProfileView() {
  const [activeTab, setActiveTab] = useState(0);
  const p = DUMMY_PROFILE;

  return (
    <div className="pb-28">
      <div className="relative h-44 w-full overflow-hidden">
        <Image
          src={picsumPost(p.coverSeed, 800, 400)}
          alt=""
          fill
          className="object-cover blur-[2px] brightness-[0.55]"
          sizes="430px"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060814] via-transparent to-black/30" />
        <Link
          href="/feed"
          className="absolute left-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/55"
          aria-label="Back to feed"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <div className="absolute right-3 top-3 z-20 flex gap-2">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-md"
            aria-label="Share profile"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-md"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative -mt-14 flex flex-col items-center px-4">
        <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-full bg-[#060814] p-[3px] shadow-[0_0_0_3px_rgba(59,130,246,0.35),0_0_40px_rgba(59,130,246,0.25)]">
          <div className="relative h-full w-full overflow-hidden rounded-full">
            <Image
              src={picsumAvatar(p.avatarSeed, 256)}
              alt=""
              width={104}
              height={104}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
        <h1 className="mt-4 text-center text-xl font-bold text-white">
          {p.displayName}
        </h1>
        <p className="text-sm text-zinc-500">{p.handle}</p>

        <div className="mt-6 grid w-full max-w-sm grid-cols-3 gap-2 rounded-2xl border border-white/[0.06] bg-[#0c1018] px-2 py-4">
          <div className="text-center">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Rating
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-white">
              {p.rating.toLocaleString()}
            </p>
          </div>
          <div className="border-x border-white/[0.06] text-center">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Followers
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {p.followersLabel}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Following
            </p>
            <p className="mt-1 text-sm font-semibold text-white">{p.following}</p>
          </div>
        </div>

        <div className="mt-5 flex w-full max-w-sm gap-3">
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#2563eb] py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20"
          >
            <UserPen className="h-4 w-4" />
            Edit Profile
          </button>
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#3b82f6]/40 bg-white/[0.04] py-3.5 text-sm font-semibold text-white"
          >
            <BarChart3 className="h-4 w-4 text-[#60a5fa]" />
            Insights
          </button>
        </div>
      </div>

      <div className="mt-8 border-b border-white/[0.06] px-4">
        <div className="-mb-px flex gap-6 overflow-x-auto pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {p.tabs.map((tab, i) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActiveTab(i)}
              className={`shrink-0 whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition ${
                activeTab === i
                  ? "border-white text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label} {String(tab.count).padStart(2, "0")}
            </button>
          ))}
        </div>
      </div>

      <div className="columns-2 gap-2 px-4 pt-4">
        {p.gallery.map((g) => (
          <div
            key={g.id}
            className="mb-2 break-inside-avoid overflow-hidden rounded-2xl bg-zinc-900"
            style={{ minHeight: g.h }}
          >
            <Image
              src={picsumPost(g.id, 400, g.h * 2)}
              alt=""
              width={400}
              height={g.h * 2}
              className="w-full object-cover"
              sizes="200px"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
