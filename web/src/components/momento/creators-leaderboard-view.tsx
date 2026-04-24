"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { fetchAdminActivityTable } from "@/lib/snapzo-api";
import { ipfsGatewayUrl } from "@/lib/snapzo-profile-local";

interface CreatorRow {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  wallet: string;
  posts: number;
  likes: number;
  replies: number;
  unlocks: number;
  score: number;
}

export function CreatorsLeaderboardView() {
  const usersQuery = useQuery({
    queryKey: ["leaderboardUsersDb"],
    queryFn: ({ signal }) =>
      fetchAdminActivityTable("users", { page: 1, pageSize: 100 }, signal),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const rows = useMemo(() => {
    const raw = usersQuery.data?.items ?? [];
    return raw
      .map((item) => {
        const posts = Number(item.posts ?? 0);
        const likes = Number(item.likes ?? 0);
        const replies = Number(item.replies ?? 0);
        const unlocks = Number(item.unlocks ?? 0);
        const score = posts * 5 + likes * 3 + replies * 2 + unlocks;
        const displayName =
          typeof item.displayName === "string" && item.displayName.trim()
            ? item.displayName.trim()
            : typeof item.username === "string" && item.username.trim()
              ? item.username.trim()
              : typeof item.wallet === "string"
                ? `${item.wallet.slice(0, 6)}...${item.wallet.slice(-4)}`
                : "Unknown";
        return {
          id: String(item.id ?? item.wallet ?? displayName),
          name: displayName,
          handle:
            typeof item.username === "string" && item.username.trim()
              ? `@${item.username.trim()}`
              : null,
          avatarUrl:
            typeof item.profileImage === "string" && item.profileImage.trim()
              ? ipfsGatewayUrl(item.profileImage.trim())
              : null,
          wallet: String(item.wallet ?? ""),
          posts,
          likes,
          replies,
          unlocks,
          score,
        } satisfies CreatorRow;
      })
      .sort((a, b) => {
        if (a.score === b.score) return 0;
        return a.score > b.score ? -1 : 1;
      });
  }, [usersQuery.data?.items]);

  return (
    <main className="pb-28 pt-5">
      <div className="px-4">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Creators</h1>
        <p className="mt-1 text-sm text-zinc-400">Top creators from real backend users/activity.</p>
      </div>

      <section className="snapzo-card-primary mx-4 mt-4 p-3">
        {usersQuery.isLoading ? (
          <p className="px-2 py-8 text-center text-sm text-zinc-500">Loading leaderboard…</p>
        ) : usersQuery.isError ? (
          <p className="px-2 py-8 text-center text-sm text-red-300/90">
            Could not load leaderboard data from API.
          </p>
        ) : null}
        <ol className="space-y-2">
          {rows.map((row, idx) => (
            <li key={row.id}>
              <Link
                href={`/profile?wallet=${row.wallet}`}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-black/26 px-3 py-2.5 transition-colors hover:bg-black/36 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/70"
                aria-label={`Open ${row.name} profile`}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-xs font-semibold text-zinc-200">
                  {idx === 0 ? <Crown className="h-4 w-4 text-amber-300" /> : idx + 1}
                </div>
                <div className="relative h-9 w-9 overflow-hidden rounded-full ring-1 ring-white/20">
                  {row.avatarUrl ? (
                    <Image src={row.avatarUrl} alt="" width={36} height={36} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-zinc-700 text-[10px] font-semibold text-zinc-200">
                      {row.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{row.name}</p>
                  <p className="truncate text-xs text-zinc-500">{row.handle ?? row.wallet}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold text-emerald-200/95">{row.score}</p>
                  <p className="text-[10px] text-zinc-600">
                    {row.posts}p · {row.likes}l · {row.replies}r · {row.unlocks}u
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
        {!usersQuery.isLoading && !usersQuery.isError && rows.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-zinc-500">No users found in database.</p>
        ) : null}
      </section>
    </main>
  );
}
