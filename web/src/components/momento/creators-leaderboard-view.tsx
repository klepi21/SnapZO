"use client";

import Image from "next/image";
import { useMemo } from "react";
import { Crown } from "lucide-react";
import { formatUnits } from "viem";
import { useReadContracts } from "wagmi";

import { SnapInlineIcon } from "@/components/icons/snap-inline-icon";
import { DUMMY_POSTS, picsumAvatar } from "@/lib/dummy/social";
import { erc20BalanceAbi } from "@/lib/constants/musd";
import { SNAP_DECIMALS, SNAPZO_SNAP_TOKEN_ADDRESS } from "@/lib/constants/snapzo-hub";

interface CreatorRow {
  id: string;
  name: string;
  handle: string;
  avatarSeed: number;
  address: `0x${string}`;
}

function formatSnap2(value: bigint | undefined): string {
  if (value === undefined) {
    return "0";
  }
  const full = formatUnits(value, SNAP_DECIMALS);
  const dot = full.indexOf(".");
  if (dot === -1) return full;
  const intPart = full.slice(0, dot);
  const frac = full.slice(dot + 1, dot + 3).replace(/0+$/, "");
  return frac ? `${intPart}.${frac}` : intPart;
}

export function CreatorsLeaderboardView() {
  const creators = useMemo<CreatorRow[]>(() => {
    const map = new Map<string, CreatorRow>();
    for (const post of DUMMY_POSTS) {
      if (!map.has(post.tipRecipient)) {
        map.set(post.tipRecipient, {
          id: post.id,
          name: post.userName,
          handle: `@${post.userHandle}`,
          avatarSeed: post.avatarSeed,
          address: post.tipRecipient,
        });
      }
    }
    return [...map.values()];
  }, []);

  const balances = useReadContracts({
    contracts: creators.map((c) => ({
      address: SNAPZO_SNAP_TOKEN_ADDRESS,
      abi: erc20BalanceAbi,
      functionName: "balanceOf",
      args: [c.address],
    })),
    query: {
      enabled: creators.length > 0,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  });

  const rows = useMemo(() => {
    return creators
      .map((creator, i) => {
        const result = balances.data?.[i];
        const snapBal = result?.status === "success" ? result.result : BigInt(0);
        return { ...creator, snapBal };
      })
      .sort((a, b) => {
        if (a.snapBal === b.snapBal) return 0;
        return a.snapBal > b.snapBal ? -1 : 1;
      });
  }, [balances.data, creators]);

  return (
    <main className="pb-28 pt-5">
      <div className="px-4">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Creators leaderboard</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Top creators by <SnapInlineIcon size={24} decorative /> SNAP balance
        </p>
      </div>

      <section className="mx-4 mt-4 rounded-3xl border border-white/[0.08] bg-zinc-900/45 p-3 backdrop-blur-xl">
        <ol className="space-y-2">
          {rows.map((row, idx) => (
            <li
              key={row.address}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-black/30 px-3 py-2.5"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-xs font-semibold text-zinc-200">
                {idx === 0 ? <Crown className="h-4 w-4 text-amber-300" /> : idx + 1}
              </div>
              <div className="relative h-9 w-9 overflow-hidden rounded-full ring-1 ring-white/20">
                <Image
                  src={picsumAvatar(row.avatarSeed, 96)}
                  alt=""
                  width={36}
                  height={36}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{row.name}</p>
                <p className="truncate text-xs text-zinc-500">{row.handle}</p>
              </div>
              <div className="text-right">
                <p className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-emerald-200/95">
                  {formatSnap2(row.snapBal)}
                  <SnapInlineIcon size={24} decorative />
                </p>
                <p className="text-[10px] text-zinc-600">SNAP</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
