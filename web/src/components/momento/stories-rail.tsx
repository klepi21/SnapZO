"use client";

import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import {
  createStory,
  fetchStoriesFeed,
  markStorySeen,
  type StoryFeedItem,
} from "@/lib/snapzo-api";
import { ipfsGatewayUrl } from "@/lib/snapzo-profile-local";

const STORY_DURATION_MS = 7000;

function shortWallet(wallet: string): string {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function StoriesRail() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const [localSeen, setLocalSeen] = useState<Set<string>>(new Set());

  const storiesQuery = useQuery({
    queryKey: ["stories-feed", address?.toLowerCase() ?? null],
    queryFn: ({ signal }) => fetchStoriesFeed({ viewerWallet: address?.toLowerCase() }, signal),
    staleTime: 10_000,
    retry: 1,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!address) throw new Error("Connect wallet first");
      const dataUrl = await readFileAsDataUrl(file);
      await createStory({
        creatorWallet: address.toLowerCase(),
        mediaBase64: dataUrl,
        mediaName: file.name,
        mediaMimeType: file.type || "image/jpeg",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stories-feed"] });
    },
  });

  const seenMutation = useMutation({
    mutationFn: async (input: { viewerWallet: string; storyId: string }) => {
      await markStorySeen(input);
    },
  });

  const groups = storiesQuery.data?.items ?? [];
  const currentGroup =
    activeGroupIndex !== null && groups[activeGroupIndex] ? groups[activeGroupIndex] : null;
  const currentStory = currentGroup?.stories[activeStoryIndex] ?? null;

  useEffect(() => {
    setLocalSeen(new Set());
  }, [address]);

  useEffect(() => {
    if (activeGroupIndex === null || !currentStory) return;
    setElapsedMs(0);
  }, [activeGroupIndex, activeStoryIndex, currentStory?.id]);

  useEffect(() => {
    if (!currentStory || activeGroupIndex === null || paused) return;
    const stepMs = 50;
    const timer = window.setInterval(() => {
      setElapsedMs((prev) => prev + stepMs);
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [currentStory, activeGroupIndex, paused]);

  const goNext = useMemo(
    () => () => {
      if (activeGroupIndex === null) return;
      const group = groups[activeGroupIndex];
      if (!group) return;
      if (activeStoryIndex < group.stories.length - 1) {
        setActiveStoryIndex((v) => v + 1);
        return;
      }
      if (activeGroupIndex < groups.length - 1) {
        setActiveGroupIndex((v) => (v === null ? null : v + 1));
        setActiveStoryIndex(0);
        return;
      }
      setActiveGroupIndex(null);
      setActiveStoryIndex(0);
      setElapsedMs(0);
    },
    [activeGroupIndex, activeStoryIndex, groups]
  );

  const goPrev = useMemo(
    () => () => {
      if (activeGroupIndex === null) return;
      if (activeStoryIndex > 0) {
        setActiveStoryIndex((v) => Math.max(0, v - 1));
        return;
      }
      if (activeGroupIndex > 0) {
        const prevGroup = groups[activeGroupIndex - 1];
        setActiveGroupIndex(activeGroupIndex - 1);
        setActiveStoryIndex(Math.max(0, prevGroup.stories.length - 1));
        return;
      }
    },
    [activeGroupIndex, activeStoryIndex, groups]
  );

  useEffect(() => {
    if (elapsedMs < STORY_DURATION_MS) return;
    goNext();
  }, [elapsedMs, goNext]);

  useEffect(() => {
    if (!currentStory || !address) return;
    if (currentStory.seen || localSeen.has(currentStory.id)) return;
    setLocalSeen((prev) => {
      const next = new Set(prev);
      next.add(currentStory.id);
      return next;
    });
    void seenMutation.mutateAsync({
      viewerWallet: address.toLowerCase(),
      storyId: currentStory.id,
    });
  }, [address, currentStory, localSeen, seenMutation]);

  const groupsWithLocalSeen = useMemo(
    () =>
      groups.map((group) => {
        const hasUnseen = group.stories.some((story) => !story.seen && !localSeen.has(story.id));
        return { ...group, hasUnseen };
      }),
    [groups, localSeen]
  );

  function openGroup(groupIndex: number) {
    const group = groupsWithLocalSeen[groupIndex];
    if (!group) return;
    const firstUnseen = group.stories.findIndex((story) => !story.seen && !localSeen.has(story.id));
    setActiveGroupIndex(groupIndex);
    setActiveStoryIndex(firstUnseen >= 0 ? firstUnseen : 0);
    setElapsedMs(0);
    setPaused(false);
  }

  return (
    <>
      <section className="px-3 pb-3">
        <div className="scrollbar-hide flex items-start gap-3 overflow-x-auto px-1 py-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"
            aria-label="Add story"
          >
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 ring-1 ring-white/15">
              <span className="text-2xl font-light text-fuchsia-300">+</span>
            </span>
            <span className="max-w-[72px] truncate text-[11px] text-zinc-300">
              {uploadMutation.isPending ? "Uploading..." : "Your story"}
            </span>
          </button>

          {groupsWithLocalSeen.map((group, idx) => {
            const avatarUrl =
              group.creatorProfileImage && group.creatorProfileImage.trim()
                ? ipfsGatewayUrl(group.creatorProfileImage.trim())
                : null;
            const label =
              group.creatorUsername?.trim() ||
              group.creatorDisplayName?.trim() ||
              shortWallet(group.creatorWallet);
            return (
              <button
                key={group.creatorWallet}
                type="button"
                onClick={() => openGroup(idx)}
                className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"
                aria-label={`Open ${label} story`}
              >
                <span
                  className={`relative flex h-16 w-16 items-center justify-center rounded-full p-[2px] ${
                    group.hasUnseen
                      ? "bg-[conic-gradient(from_220deg_at_50%_50%,#f97316,#ec4899,#8b5cf6,#f97316)]"
                      : "bg-zinc-700"
                  }`}
                >
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-[#0a1024] p-[2px]">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt=""
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold text-zinc-100">
                        {label.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </span>
                </span>
                <span className="max-w-[72px] truncate text-[11px] text-zinc-300">{label}</span>
              </button>
            );
          })}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.currentTarget.value = "";
            if (!file) return;
            void uploadMutation.mutateAsync(file);
          }}
        />
      </section>

      {activeGroupIndex !== null && currentGroup && currentStory ? (
        <div className="fixed inset-0 z-[120] bg-black/95">
          <button
            type="button"
            className="absolute left-0 top-0 h-full w-1/3"
            onClick={goPrev}
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
            aria-label="Previous story"
          />
          <button
            type="button"
            className="absolute right-0 top-0 h-full w-2/3"
            onClick={goNext}
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
            aria-label="Next story"
          />

          <div className="absolute left-3 right-3 top-3 z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {currentGroup.creatorProfileImage ? (
                <Image
                  src={ipfsGatewayUrl(currentGroup.creatorProfileImage) ?? ""}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full object-cover ring-1 ring-white/30"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-semibold text-zinc-200">
                  {(currentGroup.creatorDisplayName || currentGroup.creatorUsername || "S")
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
              )}
              <span className="text-sm font-medium text-white">
                {currentGroup.creatorDisplayName ||
                  currentGroup.creatorUsername ||
                  shortWallet(currentGroup.creatorWallet)}
              </span>
            </div>
            <button
              type="button"
              className="rounded-full bg-black/40 p-1.5 text-zinc-200"
              onClick={() => setActiveGroupIndex(null)}
              aria-label="Close stories"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative flex h-full w-full items-center justify-center px-4 py-14">
            <Image
              src={ipfsGatewayUrl(currentStory.ipfsHash) ?? ""}
              alt=""
              fill
              className="object-contain"
              priority
            />
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10">
            <div
              className="h-full bg-white transition-[width] duration-75"
              style={{ width: `${Math.min(100, (elapsedMs / STORY_DURATION_MS) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
