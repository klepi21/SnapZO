"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAddress } from "viem";
import { useAccount } from "wagmi";
import { PostCard } from "@/components/momento/post-card";
import { StoriesRail } from "@/components/momento/stories-rail";
import { dummyTipRecipient, type FeedPost } from "@/lib/dummy/social";
import { fetchFeed, fetchOnlySnapsPlan, type FeedItem } from "@/lib/snapzo-api";
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
    caption: item.content?.trim() || "Untitled post",
    visibility: item.visibility,
    subscriberOnlyLocked: item.subscriberOnlyLocked,
    contentLocked: item.isLocked,
    unlockedByMe: item.unlockedByMe,
    unlockPriceMusd: item.unlockPrice,
    tipRecipient,
  };
}

export default function FeedPage() {
  const { address } = useAccount();
  const feedQuery = useQuery({
    queryKey: ["feed", address?.toLowerCase() ?? null],
    queryFn: async ({ signal }) => {
      const raw = await fetchFeed({ viewer: address?.toLowerCase(), limit: 20 }, signal);
      // Hard client guard: main feed must never show subscriber-only posts.
      const filtered = raw.items.filter((item) => item.visibility !== "subscriber_only");
      const creatorWallets = [...new Set(filtered.map((item) => item.creatorWallet.toLowerCase()))];
      const plans = await Promise.all(
        creatorWallets.map(async (wallet) => {
          try {
            const plan = await fetchOnlySnapsPlan(wallet, signal);
            return [wallet, Boolean(plan.monthlyPriceWei && plan.monthlyPriceWei !== "0")] as const;
          } catch {
            return [wallet, false] as const;
          }
        })
      );
      const planMap = new Map(plans);
      return {
        ...raw,
        items: filtered.map((item) => ({
          ...item,
          creatorHasOnlySnaps: planMap.get(item.creatorWallet.toLowerCase()) ?? false,
        })),
      };
    },
    staleTime: 15_000,
    retry: 1,
  });

  const posts = useMemo(
    () => (feedQuery.data?.items ?? []).map(mapFeedItemToPost),
    [feedQuery.data?.items],
  );

  return (
    <main className="pb-24 pt-8">
      <StoriesRail />
      {feedQuery.isError ? (
        <p className="px-4 pb-3 text-sm text-zinc-400">
          Feed unavailable right now. Check backend connection.
        </p>
      ) : null}
      {!feedQuery.isLoading && posts.length === 0 ? (
        <p className="px-4 pb-3 text-sm text-zinc-400">No posts yet.</p>
      ) : null}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </main>
  );
}
