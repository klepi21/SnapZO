"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAddress } from "viem";
import { useAccount } from "wagmi";
import { PostCard } from "@/components/momento/post-card";
import { dummyTipRecipient, type FeedPost } from "@/lib/dummy/social";
import { fetchFeed, fetchOnlySnapsFeed, type FeedItem } from "@/lib/snapzo-api";
import { ipfsGatewayUrl } from "@/lib/snapzo-profile-local";

function shortWallet(wallet: string): string {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function createdAtToAgo(createdAt: string): string {
  const at = Date.parse(createdAt);
  if (Number.isNaN(at)) return "Now";
  const sec = Math.floor((Date.now() - at) / 1000);
  if (sec < 60) return "Now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m Ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h Ago`;
  return `${Math.floor(sec / 86400)}d Ago`;
}

function hashSeed(input: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return (h % mod) + 1;
}

function mapFeedItemToPost(item: FeedItem): FeedPost {
  let tipRecipient = dummyTipRecipient(item.postId);
  try {
    tipRecipient = getAddress(item.creatorWallet);
  } catch {
    // keep deterministic fallback
  }
  const imageCid = item.ipfsHash || item.blurImage || undefined;
  const imageUrl = imageCid ? ipfsGatewayUrl(imageCid) : undefined;
  const avatarUrl =
    item.creatorProfileImage && item.creatorProfileImage.trim()
      ? ipfsGatewayUrl(item.creatorProfileImage.trim())
      : undefined;
  const handle = item.creatorUsername?.trim() || shortWallet(item.creatorWallet);
  const name = item.creatorDisplayName?.trim() || handle;

  return {
    id: item.postId,
    creatorWallet: item.creatorWallet,
    postObjectId: item.id,
    socialPostId:
      typeof item.socialPostId === "number" && Number.isFinite(item.socialPostId)
        ? item.socialPostId
        : undefined,
    userName: name,
    userHandle: handle,
    creatorHasOnlySnaps: Boolean(item.creatorHasOnlySnaps),
    avatarUrl,
    avatarSeed: hashSeed(`${item.creatorWallet}:avatar`, 100),
    timeAgo: createdAtToAgo(item.createdAt),
    imageUrl,
    imageId: hashSeed(`${item.postId}:image`, 1084),
    imageWidth: 800,
    imageHeight: 1000,
    likes: item.tipCount ?? 0,
    comments: item.commentCount ?? 0,
    unlockCount: item.unlockCount ?? 0,
    likedBySeeds: [13, 27, 39],
    caption: item.content?.trim() || "OnlySnaps post",
    visibility: item.visibility,
    subscriberOnlyLocked: item.subscriberOnlyLocked,
    contentLocked: item.isLocked,
    unlockedByMe: item.unlockedByMe,
    unlockPriceMusd: item.unlockPrice,
    tipRecipient,
  };
}

export default function OnlySnapsPage() {
  const { address } = useAccount();
  const feedQuery = useQuery({
    queryKey: ["onlysnaps-feed", address?.toLowerCase() ?? null],
    queryFn: async ({ signal }) => {
      const viewerWallet = address?.toLowerCase() ?? "";
      try {
        return await fetchOnlySnapsFeed({ viewerWallet, limit: 20 }, signal);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        // Backward-compatible fallback while backend route rollout completes.
        if (!message.includes("failed (404)")) throw error;
        const legacyFeed = await fetchFeed({ viewer: viewerWallet, limit: 50 }, signal);
        return {
          items: legacyFeed.items.filter(
            (item) => item.visibility === "subscriber_only" && Boolean(item.unlockedByMe)
          ),
          nextCursor: null,
        };
      }
    },
    enabled: Boolean(address),
    staleTime: 15_000,
    retry: 1,
  });

  const posts = useMemo(
    () => (feedQuery.data?.items ?? []).map(mapFeedItemToPost),
    [feedQuery.data?.items]
  );
  const showEmptyState = !feedQuery.isLoading && !feedQuery.isError && posts.length === 0;

  return (
    <main className="pb-24 pt-8">
      <div className="mb-4 px-4">
        <div className="flex flex-col items-center gap-1.5">
          <Image
            src="/snapzo-logo-icon2.png"
            alt="OnlySnaps"
            width={26}
            height={26}
            className="h-6 w-6 object-contain"
          />
          <h1 className="text-center text-[28px] font-semibold italic tracking-tight text-zinc-100 [font-family:Georgia,Times,serif]">
            OnlySnaps
          </h1>
        </div>
      </div>
      {!address ? (
        <div className="px-4 pb-3">
          <div className="mx-auto flex max-w-[360px] flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-7 text-center">
            <Image
              src="/snapzo-logo-icon2.png"
              alt="SnapZo"
              width={48}
              height={48}
              className="mb-3 h-12 w-12 rounded-xl object-contain"
            />
            <p className="text-sm font-medium text-zinc-100">Your private creator feed</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Connect wallet to unlock OnlySnaps and see subscriber-only posts in one place.
            </p>
          </div>
        </div>
      ) : null}
      {feedQuery.isError ? (
        <p className="px-4 pb-3 text-sm text-zinc-400">
          OnlySnaps feed unavailable right now. Check backend connection.
        </p>
      ) : null}
      {showEmptyState && address ? (
        <div className="px-4 pb-3">
          <div className="mx-auto flex max-w-[360px] flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-7 text-center">
            <Image
              src="/snapzo-logo-icon2.png"
              alt="SnapZo"
              width={56}
              height={56}
              className="mb-3 h-14 w-14 rounded-xl object-contain"
            />
            <p className="text-sm font-medium text-zinc-100">No active subscriptions yet</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              OnlySnaps is your premium stream. Subscribe from a creator profile and their locked
              subscriber posts will appear here.
            </p>
          </div>
        </div>
      ) : null}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </main>
  );
}
