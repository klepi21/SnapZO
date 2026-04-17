"use client";

import NextImage from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ChevronLeft, ImagePlus, Loader2, Lock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { MusdInlineIcon } from "@/components/icons/musd-inline-icon";
import { useSnapzoToast } from "@/components/providers/snapzo-toast-provider";
import { getSnapzoApiBaseUrl } from "@/lib/snapzo-api";
import { APP_CREATOR_REVENUE_EXPLAINER } from "@/lib/brand";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Resize wide images and encode as JPEG for smaller JSON payloads to `/api/posts`. */
async function compressImageToJpegDataUrl(
  file: File,
  maxWidth = 1600,
  quality = 0.82,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return readFileAsDataUrl(file);
  }
  const dataUrl = await readFileAsDataUrl(file);
  const img = document.createElement("img");
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = dataUrl;
  });
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w < 1 || h < 1) {
    return dataUrl;
  }
  if (w > maxWidth) {
    const scale = maxWidth / w;
    w = maxWidth;
    h = Math.max(1, Math.round(h * scale));
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return dataUrl;
  }
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

async function makeBlurredPreviewFromDataUrl(
  dataUrl: string,
  maxWidth = 480,
): Promise<string> {
  const img = document.createElement("img");
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("blur preview failed"));
    img.src = dataUrl;
  });
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w > maxWidth) {
    const scale = maxWidth / w;
    w = maxWidth;
    h = Math.max(1, Math.round(h * scale));
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return dataUrl;
  }
  ctx.filter = "blur(14px)";
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = "none";
  return canvas.toDataURL("image/jpeg", 0.55);
}

export function CreatePostView() {
  const router = useRouter();
  const toast = useSnapzoToast();
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [unlockMusd, setUnlockMusd] = useState("0.1");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onPickFile = useCallback((f: File | null) => {
    if (!f) {
      setFile(null);
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast("Choose an image file (JPEG, PNG, WebP…).", "error");
      return;
    }
    const maxBytes = 18 * 1024 * 1024;
    if (f.size > maxBytes) {
      toast("Image is too large (max ~18 MB).", "error");
      return;
    }
    setFile(f);
  }, [toast]);

  const handleSubmit = async () => {
    if (!isConnected || !address) {
      openConnectModal?.();
      return;
    }
    if (!file) {
      toast("Add a photo first.", "error");
      return;
    }
    const trimmed = caption.trim();
    if (trimmed.length > 5000) {
      toast("Caption is too long.", "error");
      return;
    }
    let price = 0;
    if (isLocked) {
      price = Number.parseFloat(unlockMusd.replace(",", "."));
      if (!Number.isFinite(price) || price <= 0) {
        toast("Set an unlock price greater than 0 MUSD.", "error");
        return;
      }
    }

    setSubmitting(true);
    try {
      const mediaDataUrl = await compressImageToJpegDataUrl(file);
      let blurImageBase64: string | undefined;
      let blurMediaName: string | undefined;
      let blurMediaMimeType: string | undefined;
      if (isLocked) {
        try {
          blurImageBase64 = await makeBlurredPreviewFromDataUrl(mediaDataUrl);
          blurMediaName = "preview-blur.jpg";
          blurMediaMimeType = "image/jpeg";
        } catch {
          // locked post still valid without blur preview
        }
      }

      const base = getSnapzoApiBaseUrl();
      const res = await fetch(`${base}/api/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorWallet: address,
          content: trimmed,
          mediaBase64: mediaDataUrl,
          mediaName: file.name.replace(/[^\w.\-]+/g, "_") || "upload.jpg",
          mediaMimeType: "image/jpeg",
          blurImageBase64,
          blurMediaName,
          blurMediaMimeType,
          isLocked,
          unlockPrice: isLocked ? price : 0,
        }),
      });

      const raw = await res.text();
      let json: { error?: string } | null = null;
      try {
        json = raw ? (JSON.parse(raw) as { error?: string }) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        const msg =
          json?.error ??
          (raw ? raw.slice(0, 200) : `Request failed (${res.status})`);
        throw new Error(msg);
      }

      toast("Post published");
      router.push("/feed");
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Could not publish. Is the SnapZO API running?";
      toast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="pb-28 pt-5">
      <div className="mb-4 flex items-center gap-2 px-4">
        <Link
          href="/feed"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-black/25 text-white backdrop-blur-md transition hover:bg-white/10"
          aria-label="Back to feed"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-white">New post</h1>
          <p className="text-xs font-normal text-zinc-500">
            Photo, caption, optional paid unlock
          </p>
        </div>
      </div>

      <div className="mx-4 overflow-hidden rounded-[28px] border border-white/[0.1] bg-white/[0.045] shadow-[0_20px_56px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
        <div className="border-b border-white/[0.08] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Photo
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              onPickFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed border-white/15 bg-black/20 py-10 text-zinc-400 transition hover:border-indigo-400/35 hover:bg-white/[0.04] hover:text-zinc-200"
          >
            {previewUrl ? (
              <div className="relative mx-auto aspect-[4/5] w-full max-w-[280px] overflow-hidden rounded-[18px] ring-1 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob: URLs */}
                <img
                  src={previewUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <>
                <ImagePlus className="h-10 w-10 opacity-80" strokeWidth={1.25} />
                <span className="text-sm font-medium text-zinc-300">Tap to choose image</span>
                <span className="text-xs font-normal text-zinc-600">JPEG · PNG · WebP</span>
              </>
            )}
          </button>
          {file ? (
            <button
              type="button"
              onClick={() => onPickFile(null)}
              className="mt-2 w-full text-center text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
            >
              Remove photo
            </button>
          ) : null}
        </div>

        <div className="border-b border-white/[0.08] px-4 py-4">
          <label
            htmlFor="snapzo-create-caption"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500"
          >
            Caption
          </label>
          <textarea
            id="snapzo-create-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Write a caption…"
            disabled={submitting}
            className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-sm leading-relaxed text-white placeholder:text-zinc-600 outline-none ring-0 transition focus:border-indigo-400/40 focus:ring-1 focus:ring-indigo-500/25 disabled:opacity-50"
          />
          <p className="mt-1.5 text-right text-[11px] font-normal tabular-nums text-zinc-600">
            {caption.length} / 5000
          </p>
        </div>

        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-black/15 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-400/25">
                <Lock className="h-5 w-5 text-indigo-200/90" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Hidden until unlock</p>
                <p className="text-xs font-normal leading-snug text-zinc-500">
                  Followers pay the quoted MUSD value in SNAP once to reveal the full photo
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isLocked}
              aria-label="Hidden until unlock"
              disabled={submitting}
              onClick={() => setIsLocked((v) => !v)}
              className={`relative h-8 w-[52px] shrink-0 rounded-full border transition ${
                isLocked
                  ? "border-indigo-400/50 bg-gradient-to-r from-indigo-500 to-sky-600"
                  : "border-white/15 bg-zinc-900/90"
              } disabled:opacity-50`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  isLocked ? "left-[calc(100%-1.65rem)]" : "left-1"
                }`}
              />
            </button>
          </div>

          {isLocked ? (
            <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
              <label
                htmlFor="snapzo-unlock-price"
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500"
              >
                Unlock price
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-2.5">
                <input
                  id="snapzo-unlock-price"
                  type="text"
                  inputMode="decimal"
                  value={unlockMusd}
                  onChange={(e) => setUnlockMusd(e.target.value)}
                  disabled={submitting}
                  className="min-w-0 flex-1 border-0 bg-transparent text-lg font-semibold tabular-nums text-white outline-none placeholder:text-zinc-600"
                  placeholder="0.10"
                  aria-describedby="snapzo-unlock-hint"
                />
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-violet-500/15 px-2 py-1 font-mono text-xs font-semibold text-violet-200">
                  MUSD
                  <MusdInlineIcon size={12} className="rounded-full object-cover opacity-90" />
                </span>
              </div>
              <p id="snapzo-unlock-hint" className="mt-2 text-xs leading-relaxed text-zinc-500">
                Shown in MUSD; fans settle in 18-decimal SNAP from the Earn hub at the live pool
                ratio. Required when hidden mode is on.
              </p>
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/[0.08] bg-black/15 px-4 py-4">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-400/40 bg-gradient-to-br from-indigo-500/35 to-sky-500/25 py-3.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(99,102,241,0.18)] transition hover:border-indigo-300/55 hover:from-indigo-500/45 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Publishing…
              </>
            ) : (
              "Share post"
            )}
          </button>
          <p className="mt-3 text-center text-[11px] font-normal leading-relaxed text-zinc-600">
            Wallet required ·{" "}
            <span className="text-zinc-500">API {getSnapzoApiBaseUrl()}</span>
          </p>
        </div>
      </div>

      <div className="mx-4 mt-5 flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-[#0c1018]/90 px-4 py-3">
        <div className="relative mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-indigo-500/30">
          {isConnected && address ? (
            <NextImage
              src={`https://picsum.photos/seed/${encodeURIComponent(address)}/72/72`}
              alt=""
              width={36}
              height={36}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-[10px] font-bold text-zinc-500">
              ?
            </div>
          )}
        </div>
        <p className="text-xs leading-relaxed text-zinc-500">
          {!isConnected
            ? "Connect a wallet so we can attach your post to your address (for MUSD-quoted SNAP tips and unlocks on-chain)."
            : `Your wallet identifies you as the creator. ${APP_CREATOR_REVENUE_EXPLAINER} Photos are normal uploads (not NFTs); publishing uses the API as it exists today.`}
        </p>
      </div>
    </main>
  );
}
