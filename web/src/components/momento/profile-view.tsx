"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Settings, Share2, User as UserIcon, UserPen, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "wagmi";
import { SnapInlineIcon } from "@/components/icons/snap-inline-icon";
import {
  fetchUserProfileWithPosts,
  updateProfile,
  type UpdateProfilePayload,
  type UserPostItem,
} from "@/lib/snapzo-api";
import {
  defaultSnapzoProfile,
  ipfsGatewayUrl,
  persistSnapzoProfile,
  readSnapzoProfile,
  SNAPZO_PROFILE_HYDRATED_EVENT,
  type SnapzoProfileLocal,
} from "@/lib/snapzo-profile-local";

async function fileToAvatarDataUrl(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) {
    return null;
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const img = document.createElement("img");
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("bad image"));
    img.src = dataUrl;
  });
  const max = 256;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w < 1 || h < 1) {
    return null;
  }
  if (w > max || h > max) {
    const scale = Math.min(max / w, max / h);
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function shortenAddress(addr?: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ProfileView() {
  const labelId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const { address } = useAccount();

  const [profile, setProfile] = useState<SnapzoProfileLocal>(defaultSnapzoProfile);
  const [posts, setPosts] = useState<UserPostItem[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<SnapzoProfileLocal>(defaultSnapzoProfile);

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate profile from localStorage after mount (SSR-safe default) */
  useEffect(() => {
    const reload = () => setProfile(readSnapzoProfile());
    reload();
    // Re-read when WalletLoginEffect finishes hydrating from the backend.
    window.addEventListener(SNAPZO_PROFILE_HYDRATED_EVENT, reload);
    return () =>
      window.removeEventListener(SNAPZO_PROFILE_HYDRATED_EVENT, reload);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    let cancelled = false;
    async function loadMyPosts() {
      if (!address) {
        if (!cancelled) setPosts([]);
        return;
      }
      setPostsLoading(true);
      try {
        const res = await fetchUserProfileWithPosts(address);
        if (!cancelled) setPosts(res.posts ?? []);
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    }
    void loadMyPosts();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const openEdit = useCallback(() => {
    setDraft(readSnapzoProfile());
    setEditOpen(true);
  }, []);

  const saveEdit = useCallback(() => {
    // 1. Persist locally (instant UX).
    persistSnapzoProfile(draft);
    const previous = profile;
    setProfile(readSnapzoProfile());
    setEditOpen(false);

    // 2. Sync to backend (best-effort; failure shouldn't block the UI).
    if (!address) return;

    const payload: UpdateProfilePayload = {
      displayName: draft.displayName,
      username: draft.username,
      bio: draft.bio,
    };

    // Only include avatar in the payload when it actually changed.
    if (draft.avatarDataUrl !== previous.avatarDataUrl) {
      if (!draft.avatarDataUrl) {
        payload.avatarBase64 = null;
      } else if (draft.avatarDataUrl.startsWith("data:")) {
        // Freshly picked image → upload to IPFS on the backend.
        payload.avatarBase64 = draft.avatarDataUrl;
        payload.avatarMimeType = "image/jpeg";
        payload.avatarName = "avatar.jpg";
      }
      // Otherwise it's an `https://` gateway URL (already on IPFS) — no
      // re-upload needed.
    }

    updateProfile(address, payload).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.warn("[snapzo] profile sync failed", err);
    });
  }, [draft, profile, address]);

  const handleAvatarPick = useCallback(
    async (file: File | null) => {
      if (!file) {
        return;
      }
      if (file.size > 6 * 1024 * 1024) {
        return;
      }
      const url = await fileToAvatarDataUrl(file);
      if (url) {
        setDraft((d) => ({ ...d, avatarDataUrl: url }));
      }
    },
    [],
  );

  const editModal =
    editOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/65 backdrop-blur-[2px]"
            role="presentation"
            onClick={() => setEditOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={labelId}
              className="mx-auto max-h-[min(92dvh,720px)] w-full max-w-[430px] overflow-hidden rounded-t-[24px] border border-white/10 border-b-0 bg-[#0f1528] shadow-[0_-16px_56px_rgba(0,0,0,0.55)]"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditOpen(false);
                }
              }}
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
                <h2
                  id={labelId}
                  className="text-base font-semibold tracking-tight text-white"
                >
                  Edit profile
                </h2>
                <button
                  type="button"
                  className="snapzo-pressable flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-white/[0.08] hover:text-white"
                  aria-label="Close"
                  onClick={() => setEditOpen(false)}
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </button>
              </div>

              <div className="max-h-[calc(min(92dvh,720px)-8rem)] overflow-y-auto overscroll-contain px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Profile photo
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    void handleAvatarPick(f);
                    e.target.value = "";
                  }}
                />
                <div className="mt-3 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-2 ring-fuchsia-400/45 ring-offset-2 ring-offset-[#0f1528]"
                  >
                    {draft.avatarDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- data URL from user
                      <img
                        src={draft.avatarDataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500/40 to-sky-500/25">
                        <UserIcon
                          className="h-9 w-9 text-white/70"
                          strokeWidth={1.4}
                        />
                      </div>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="snapzo-pressable text-sm font-semibold text-[#0095f6] hover:text-[#47b8ff]"
                    >
                      Change photo
                    </button>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                      JPG or PNG. We resize on device before saving locally.
                    </p>
                    {draft.avatarDataUrl ? (
                      <button
                        type="button"
                        className="snapzo-pressable mt-2 text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                        onClick={() =>
                          setDraft((d) => ({ ...d, avatarDataUrl: null }))
                        }
                      >
                        Remove custom photo
                      </button>
                    ) : null}
                  </div>
                </div>

                <label
                  htmlFor="snapzo-edit-name"
                  className="mt-6 block text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500"
                >
                  Name
                </label>
                <input
                  id="snapzo-edit-name"
                  type="text"
                  value={draft.displayName}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, displayName: e.target.value }))
                  }
                  maxLength={64}
                  className="mt-2 w-full rounded-2xl border border-white/12 bg-[#090d1b]/90 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-300/40 focus:ring-1 focus:ring-fuchsia-300/20"
                  placeholder="Your name"
                  autoComplete="name"
                />

                <label
                  htmlFor="snapzo-edit-username"
                  className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500"
                >
                  Username
                </label>
                <div className="mt-2 flex items-center rounded-2xl border border-white/12 bg-[#090d1b]/90 px-3">
                  <span className="shrink-0 text-sm text-zinc-500">@</span>
                  <input
                    id="snapzo-edit-username"
                    type="text"
                    value={draft.username}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        username: e.target.value
                          .replace(/^@+/, "")
                          .replace(/[^A-Za-z0-9_]/g, "")
                          .toLowerCase()
                          .slice(0, 30),
                      }))
                    }
                    maxLength={30}
                    className="min-w-0 flex-1 border-0 bg-transparent py-3 pl-0.5 text-sm text-white outline-none ring-0"
                    placeholder="username"
                    autoComplete="username"
                  />
                </div>

                <label
                  htmlFor="snapzo-edit-bio"
                  className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500"
                >
                  Bio
                </label>
                <textarea
                  id="snapzo-edit-bio"
                  value={draft.bio}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, bio: e.target.value }))
                  }
                  rows={4}
                  maxLength={280}
                  placeholder="Tell people about you…"
                  className="mt-2 w-full resize-none rounded-2xl border border-white/12 bg-[#090d1b]/90 px-4 py-3 text-sm leading-relaxed text-white outline-none transition focus:border-fuchsia-300/40 focus:ring-1 focus:ring-fuchsia-300/20"
                />
                <p className="mt-1 text-right text-[11px] tabular-nums text-zinc-600">
                  {draft.bio.length} / 280
                </p>
              </div>

              <div className="border-t border-white/[0.08] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                <button
                  type="button"
                  onClick={saveEdit}
                  className="snapzo-pressable w-full rounded-2xl border border-fuchsia-300/45 bg-gradient-to-br from-fuchsia-500/28 to-violet-500/25 py-3.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(217,70,239,0.18)] hover:border-fuchsia-200/60 hover:from-fuchsia-500/40"
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  const walletShort = shortenAddress(address);
  const hasProfileImage = !!profile.avatarDataUrl;
  const hasDisplayName = !!profile.displayName;
  const hasUsername = !!profile.username;
  const hasBio = !!profile.bio;
  const headerTitle = profile.displayName || walletShort || "Unnamed";
  const totalLikes = posts.reduce((sum, post) => sum + Number(post.likeCount ?? 0), 0);
  const totalReplies = posts.reduce((sum, post) => sum + Number(post.replyCount ?? 0), 0);
  const earningsSnap = posts.reduce((sum, post) => sum + Number(post.totalTips ?? 0), 0);
  const earningsSnapLabel = Number.isFinite(earningsSnap)
    ? earningsSnap.toFixed(4).replace(/\.?0+$/, "")
    : "0";

  return (
    <div className="pb-28">
      {editModal}

      <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-[#2b1747] via-[#171a32] to-[#11172b]">
        <div className="absolute inset-0 bg-gradient-to-t from-[#060814] via-transparent to-black/30" />
        <Link
          href="/feed"
          className="snapzo-pressable absolute left-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md hover:bg-black/55"
          aria-label="Back to feed"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <div className="absolute right-3 top-3 z-20 flex gap-2">
          <button
            type="button"
            className="snapzo-pressable flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-md"
            aria-label="Share profile"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="snapzo-pressable flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-md"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative -mt-14 flex flex-col items-center px-4">
        <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-full bg-[#060814] p-[3px] shadow-[0_0_0_3px_rgba(244,114,182,0.35),0_0_40px_rgba(168,85,247,0.24)]">
          <div className="relative h-full w-full overflow-hidden rounded-full">
            {hasProfileImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL from user
              <img
                src={profile.avatarDataUrl ?? undefined}
                alt=""
                width={104}
                height={104}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500/40 to-sky-500/25">
                <UserIcon
                  className="h-12 w-12 text-white/70"
                  strokeWidth={1.3}
                />
              </div>
            )}
          </div>
        </div>
        <h1
          className={`mt-4 text-center text-xl font-bold ${
            hasDisplayName ? "text-white" : "font-mono text-zinc-300"
          }`}
        >
          {headerTitle}
        </h1>
        {hasUsername ? (
          <p className="text-sm text-zinc-500">@{profile.username}</p>
        ) : null}
        {hasBio ? (
          <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-zinc-400">
            {profile.bio}
          </p>
        ) : null}

        <div className="snapzo-card-compact mt-6 grid w-full max-w-sm grid-cols-3 gap-2 bg-[#111a30]/85 px-2 py-4">
          <div className="text-center">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Likes
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-white">
              {totalLikes}
            </p>
          </div>
          <div className="border-x border-white/[0.06] text-center">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Replies
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-white">
              {totalReplies}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Earnings
            </p>
            <p className="mt-1 flex items-center justify-center gap-1 text-sm font-semibold tabular-nums text-white">
              <span>{earningsSnapLabel}</span>
              <SnapInlineIcon decorative />
              <span className="sr-only">SNAP</span>
            </p>
          </div>
        </div>

        <div className="mt-5 w-full max-w-sm">
          <button
            type="button"
            onClick={openEdit}
            className="snapzo-pressable flex w-full items-center justify-center gap-2 rounded-full border border-fuchsia-300/40 bg-gradient-to-r from-[#ff2d90] to-[#7c3aed] py-3.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25"
          >
            <UserPen className="h-4 w-4" />
            Edit profile
          </button>
        </div>
      </div>

      <div className="mt-8 px-4">
        <h2 className="text-sm font-semibold tracking-tight text-white">Posts</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          {postsLoading ? "Loading posts…" : `${posts.length} post${posts.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="snapzo-card-compact mx-4 mt-4 flex flex-col items-center justify-center border-dashed bg-[#0f162a]/85 px-6 py-10 text-center">
          <p className="text-sm text-zinc-400">Share your first post to fill this space.</p>
        </div>
      ) : (
        <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
          {posts.map((post) => {
            const cid = post.ipfsHash || post.blurImage;
            const src = cid ? ipfsGatewayUrl(cid) : null;
            return (
              <div
                key={post.id}
                className="relative aspect-square overflow-hidden rounded-xl border border-white/[0.08] bg-black"
                title={post.content ?? ""}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote user media
                  <img src={src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">
                    No media
                  </div>
                )}
                {post.isLocked ? (
                  <div className="absolute inset-x-0 bottom-0 bg-black/65 px-1.5 py-1 text-[10px] text-zinc-200">
                    Locked · {post.unlockCount ?? 0} unlock{(post.unlockCount ?? 0) === 1 ? "" : "s"}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
