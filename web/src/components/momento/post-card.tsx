"use client";

import Image from "next/image";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  Ellipsis,
  Heart,
  Lock,
  MessageCircle,
  UserRound,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { formatUnits, parseUnits, UserRejectedRequestError } from "viem";
import type { FeedPost } from "@/lib/dummy/social";
import { picsumAvatar, picsumPost } from "@/lib/dummy/social";
import { MusdInlineIcon } from "@/components/icons/musd-inline-icon";
import { SnapInlineIcon } from "@/components/icons/snap-inline-icon";
import { erc20TransferAbi, MUSD_DECIMALS } from "@/lib/constants/musd";
import {
  erc20TotalSupplyAbi,
  isSnapZoHubConfigured,
  SNAP_DECIMALS,
  SNAPZO_HUB_ADDRESS,
  SNAPZO_SNAP_TOKEN_ADDRESS,
  snapZoHubAbi,
} from "@/lib/constants/snapzo-hub";
import { mezoTestnet } from "@/lib/chains/mezo-testnet";
import { musdWeiToSnapBaseUnitsCeil } from "@/lib/snapzo/musd-snap-quote";
import {
  appendCommentForPost,
  isPostLikedInStorage,
  persistPostLiked,
  readCommentsForPost,
  type StoredComment,
} from "@/lib/snapzo-local";
import { useSnapzoToast } from "@/components/providers/snapzo-toast-provider";

interface PostCardProps {
  post: FeedPost;
}

/** Fixed MUSD-quoted like/reply; unlock uses per-post `unlockPriceMusd` (default 0.1). */
const TIP_MUSD_WEI = parseUnits("0.01", MUSD_DECIMALS);
const DEFAULT_UNLOCK_MUSD = 0.1;

function unlockMusdWeiFromPost(post: FeedPost): bigint {
  const human = post.unlockPriceMusd;
  if (human === undefined || !Number.isFinite(human) || human <= 0) {
    return parseUnits(String(DEFAULT_UNLOCK_MUSD), MUSD_DECIMALS);
  }
  const s = human.toFixed(12).replace(/\.?0+$/, "") || String(DEFAULT_UNLOCK_MUSD);
  try {
    return parseUnits(s, MUSD_DECIMALS);
  } catch {
    return parseUnits(String(DEFAULT_UNLOCK_MUSD), MUSD_DECIMALS);
  }
}

function formatMusdHumanFromWei(wei: bigint): string {
  return formatUnits(wei, MUSD_DECIMALS)
    .replace(/(\.\d*?[1-9])0+$/, "$1")
    .replace(/\.$/, "");
}

function formatUnitsMax2dp(value: bigint, decimals: number): string {
  const full = formatUnits(value, decimals);
  const dot = full.indexOf(".");
  if (dot === -1) {
    return full;
  }
  const intPart = full.slice(0, dot);
  const frac = full.slice(dot + 1, dot + 3).replace(/0+$/, "");
  return frac ? `${intPart}.${frac}` : intPart;
}

function formatTxError(e: unknown): string {
  if (e instanceof UserRejectedRequestError) {
    return "Request cancelled in wallet.";
  }
  if (e && typeof e === "object" && "shortMessage" in e) {
    const m = (e as { shortMessage?: string }).shortMessage;
    if (m) {
      return m;
    }
  }
  if (e instanceof Error) {
    return e.message.slice(0, 160);
  }
  return "Something went wrong.";
}

function formatShortTime(at: number): string {
  const sec = Math.floor((Date.now() - at) / 1000);
  if (sec < 15) {
    return "now";
  }
  if (sec < 3600) {
    return `${Math.floor(sec / 60)}m`;
  }
  if (sec < 86400) {
    return `${Math.floor(sec / 3600)}h`;
  }
  return `${Math.floor(sec / 86400)}d`;
}

export function PostCard({ post }: PostCardProps) {
  const labelId = useId();
  const commentSheetContextId = useId();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const toast = useSnapzoToast();

  const hubConfigured = isSnapZoHubConfigured();
  const hubNav = useReadContracts({
    contracts: [
      {
        chainId: mezoTestnet.id,
        address: SNAPZO_HUB_ADDRESS,
        abi: snapZoHubAbi,
        functionName: "totalAssets",
      },
      {
        chainId: mezoTestnet.id,
        address: SNAPZO_SNAP_TOKEN_ADDRESS,
        abi: erc20TotalSupplyAbi,
        functionName: "totalSupply",
      },
    ],
    query: {
      enabled: hubConfigured,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  });

  const ta = hubNav.data?.[0]?.status === "success" ? hubNav.data[0].result : undefined;
  const ts = hubNav.data?.[1]?.status === "success" ? hubNav.data[1].result : undefined;

  const unlockMusdWei = useMemo(() => unlockMusdWeiFromPost(post), [post]);
  const unlockMusdLabel = useMemo(
    () => formatMusdHumanFromWei(unlockMusdWei),
    [unlockMusdWei],
  );

  const tipSnapWei = useMemo(() => {
    if (ta === undefined || ts === undefined || ta <= BigInt(0)) {
      return undefined;
    }
    const v = musdWeiToSnapBaseUnitsCeil(TIP_MUSD_WEI, ts, ta);
    return v > BigInt(0) ? v : undefined;
  }, [ta, ts]);

  const unlockSnapWei = useMemo(() => {
    if (ta === undefined || ts === undefined || ta <= BigInt(0)) {
      return undefined;
    }
    const v = musdWeiToSnapBaseUnitsCeil(unlockMusdWei, ts, ta);
    return v > BigInt(0) ? v : undefined;
  }, [ta, ts, unlockMusdWei]);

  const tipSnapLabel =
    tipSnapWei !== undefined ? formatUnitsMax2dp(tipSnapWei, SNAP_DECIMALS) : "…";
  const unlockSnapLabel =
    unlockSnapWei !== undefined ? formatUnitsMax2dp(unlockSnapWei, SNAP_DECIMALS) : "…";

  const isLockedPost = Boolean(post.contentLocked);
  const clientReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [storageRev, setStorageRev] = useState(0);
  const [sessionUnlocked, setSessionUnlocked] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>();
  const [pendingKind, setPendingKind] = useState<
    "unlock" | "like" | "comment" | null
  >(null);
  const [pendingCommentText, setPendingCommentText] = useState<string | null>(
    null,
  );
  /** True after user initiates like until tx fails or is superseded by storage. */
  const [likePressed, setLikePressed] = useState(false);
  const lastMediaTapRef = useRef(0);

  const { isLoading: isConfirming, isSuccess, isError } =
    useWaitForTransactionReceipt({
      hash: pendingHash,
      chainId: mezoTestnet.id,
      query: { enabled: Boolean(pendingHash) },
    });

  const mediaUnlocked = !isLockedPost || sessionUnlocked;
  const hasTipped = clientReady && isPostLikedInStorage(post.id);
  void storageRev;
  const comments: StoredComment[] = clientReady
    ? readCommentsForPost(post.id)
    : [];

  const src = picsumPost(post.imageId, post.imageWidth, post.imageHeight);
  const showLockOverlay = isLockedPost && !mediaUnlocked;

  useEffect(() => {
    if (commentOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [commentOpen]);

  useEffect(() => {
    if (!pendingHash || !isSuccess || !pendingKind) {
      return;
    }
    /* eslint-disable react-hooks/set-state-in-effect -- sync UI after wagmi receipt + localStorage */
    if (pendingKind === "unlock") {
      setSessionUnlocked(true);
      toast(
        unlockSnapWei !== undefined
          ? `Unlocked · ${unlockMusdLabel} MUSD (~${formatUnitsMax2dp(unlockSnapWei, SNAP_DECIMALS)} SNAP)`
          : "Unlocked.",
      );
    } else if (pendingKind === "like") {
      persistPostLiked(post.id);
      toast(
        tipSnapWei !== undefined
          ? `Sent tip · 0.01 MUSD (~${formatUnitsMax2dp(tipSnapWei, SNAP_DECIMALS)} SNAP)`
          : "Tip sent.",
      );
    } else if (pendingKind === "comment" && pendingCommentText) {
      const trimmed = pendingCommentText.trim();
      if (trimmed) {
        const row: StoredComment = {
          id: crypto.randomUUID(),
          text: trimmed,
          txHash: pendingHash,
          at: Date.now(),
        };
        appendCommentForPost(post.id, row);
        setCommentDraft("");
        toast(
          tipSnapWei !== undefined
            ? `Comment posted · 0.01 MUSD (~${formatUnitsMax2dp(tipSnapWei, SNAP_DECIMALS)} SNAP)`
            : "Comment posted.",
        );
      }
      setPendingCommentText(null);
    }
    setStorageRev((r) => r + 1);
    if (pendingKind === "like") {
      setLikePressed(false);
    }
    setPendingHash(undefined);
    setPendingKind(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    isSuccess,
    pendingHash,
    pendingKind,
    pendingCommentText,
    post.id,
    tipSnapWei,
    unlockSnapWei,
    unlockMusdLabel,
    toast,
    setSessionUnlocked,
  ]);

  useEffect(() => {
    if (!pendingHash || !isError) {
      return;
    }
    /* eslint-disable react-hooks/set-state-in-effect -- receipt failure cleanup */
    toast("Transaction failed on-chain.", "error");
    if (pendingKind === "like") {
      setLikePressed(false);
    }
    setPendingHash(undefined);
    setPendingKind(null);
    setPendingCommentText(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isError, pendingHash, pendingKind, toast]);

  const wrongChain = isConnected && chainId !== mezoTestnet.id;

  const ensureMezo = useCallback((): boolean => {
    if (!isConnected || !address) {
      openConnectModal?.();
      return false;
    }
    if (wrongChain) {
      if (switchChain) {
        switchChain({ chainId: mezoTestnet.id });
        toast("Switch to Mezo Testnet, then try again.", "error");
      } else {
        toast("Switch to Mezo Testnet (31611) in your wallet.", "error");
      }
      return false;
    }
    return true;
  }, [address, isConnected, openConnectModal, switchChain, toast, wrongChain]);

  const isBusy = isWritePending || isConfirming || Boolean(pendingHash);

  const likedUi = hasTipped || likePressed;
  const likeCount =
    post.likes + (hasTipped ? 1 : likePressed ? 1 : 0);
  const commentCount = post.comments + comments.length;

  const handleUnlock = async () => {
    if (!isLockedPost || mediaUnlocked) {
      return;
    }
    if (!ensureMezo()) {
      return;
    }
    if (!hubConfigured) {
      toast("SnapZo hub is not configured.", "error");
      return;
    }
    if (unlockSnapWei === undefined) {
      toast("Pricing unavailable right now. Retry in a moment.", "error");
      return;
    }
    try {
      toast(`Confirm unlock · ${unlockMusdLabel} MUSD (~${unlockSnapLabel} SNAP)…`);
      const hash = await writeContractAsync({
        address: SNAPZO_SNAP_TOKEN_ADDRESS,
        abi: erc20TransferAbi,
        functionName: "transfer",
        args: [post.tipRecipient, unlockSnapWei],
        chainId: mezoTestnet.id,
      });
      setPendingKind("unlock");
      setPendingHash(hash);
      toast("Confirming on Mezo…");
    } catch (e) {
      toast(formatTxError(e), "error");
    }
  };

  const handleLikeTip = useCallback(async () => {
    if (hasTipped || likePressed) {
      return;
    }
    if (!ensureMezo()) {
      return;
    }
    if (!hubConfigured) {
      toast("SnapZo hub is not configured.", "error");
      return;
    }
    if (tipSnapWei === undefined) {
      toast("Pricing unavailable right now. Retry in a moment.", "error");
      return;
    }
    setLikePressed(true);
    try {
      toast(`Confirm tip · 0.01 MUSD (~${tipSnapLabel} SNAP)…`);
      const hash = await writeContractAsync({
        address: SNAPZO_SNAP_TOKEN_ADDRESS,
        abi: erc20TransferAbi,
        functionName: "transfer",
        args: [post.tipRecipient, tipSnapWei],
        chainId: mezoTestnet.id,
      });
      setPendingKind("like");
      setPendingHash(hash);
      toast("Confirming on Mezo…");
    } catch (e) {
      setLikePressed(false);
      toast(formatTxError(e), "error");
    }
  }, [
    ensureMezo,
    hasTipped,
    likePressed,
    hubConfigured,
    post.tipRecipient,
    tipSnapLabel,
    tipSnapWei,
    toast,
    writeContractAsync,
  ]);

  const handleMediaDoubleLike = useCallback(() => {
    if (showLockOverlay || hasTipped || likePressed || isBusy) {
      return;
    }
    void handleLikeTip();
  }, [handleLikeTip, hasTipped, isBusy, likePressed, showLockOverlay]);

  const handleMediaTouchEnd = useCallback(() => {
    if (showLockOverlay) {
      return;
    }
    const now = Date.now();
    if (now - lastMediaTapRef.current < 420) {
      lastMediaTapRef.current = 0;
      handleMediaDoubleLike();
    } else {
      lastMediaTapRef.current = now;
    }
  }, [handleMediaDoubleLike, showLockOverlay]);

  const handleSubmitComment = async () => {
    const text = commentDraft.trim();
    if (!text) {
      return;
    }
    if (!ensureMezo()) {
      return;
    }
    if (!hubConfigured) {
      toast("SnapZo hub is not configured.", "error");
      return;
    }
    if (tipSnapWei === undefined) {
      toast("Pricing unavailable right now. Retry in a moment.", "error");
      return;
    }
    try {
      setPendingCommentText(text);
      toast(`Confirm reply fee · 0.01 MUSD (~${tipSnapLabel} SNAP)…`);
      const hash = await writeContractAsync({
        address: SNAPZO_SNAP_TOKEN_ADDRESS,
        abi: erc20TransferAbi,
        functionName: "transfer",
        args: [post.tipRecipient, tipSnapWei],
        chainId: mezoTestnet.id,
      });
      setPendingKind("comment");
      setPendingHash(hash);
      toast("Confirming on Mezo…");
    } catch (e) {
      setPendingCommentText(null);
      toast(formatTxError(e), "error");
    }
  };

  return (
    <article className="mx-4 mb-5 overflow-hidden rounded-[28px] border border-white/[0.1] bg-white/[0.045] shadow-[0_20px_56px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-indigo-500/35 ring-offset-2 ring-offset-[rgba(8,12,22,0.65)]">
          <Image
            src={picsumAvatar(post.avatarSeed, 128)}
            alt=""
            width={44}
            height={44}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-white">
            {post.userName}
          </p>
          <p className="text-xs text-zinc-500">{post.timeAgo}</p>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/[0.1] bg-black/20 text-zinc-500 transition hover:border-white/18 hover:bg-white/[0.06] hover:text-white active:scale-[0.96]"
          aria-label="Post menu"
        >
          <Ellipsis className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>
      </div>

      <div
        className="relative mx-3 aspect-[4/5] touch-manipulation overflow-hidden rounded-[22px] bg-zinc-900/80 ring-1 ring-white/[0.06]"
        onDoubleClick={(e) => {
          e.preventDefault();
          handleMediaDoubleLike();
        }}
        onTouchEnd={handleMediaTouchEnd}
        role="presentation"
        title={showLockOverlay ? undefined : "Double-tap or double-click to like"}
      >
        <Image
          src={src}
          alt=""
          fill
          className={`object-cover transition-[filter,transform] duration-300 ${
            showLockOverlay ? "scale-[1.04] blur-2xl" : "blur-0"
          }`}
          sizes="(max-width: 430px) 100vw, 382px"
          priority={post.id === "1"}
        />
        {showLockOverlay ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-black/75 via-black/45 to-black/30 px-6 text-center">
            <Lock className="h-9 w-9 text-white/90" strokeWidth={1.5} aria-hidden />
            <div>
              <p className="text-sm font-semibold text-white">Hidden content</p>
              <p className="mt-2 max-w-[280px] text-xs leading-relaxed text-zinc-400">
                Pay{" "}
                <span className="inline-flex items-center gap-0.5 font-semibold text-zinc-200">
                  {unlockMusdLabel} <MusdInlineIcon decorative />
                </span>{" "}
                {"(~"}
                <span className="inline-flex items-center gap-0 font-semibold text-violet-200">
                  {unlockSnapLabel}
                  <SnapInlineIcon decorative />
                  {"SNAP"}
                </span>).
              </p>
            </div>
            <button
              type="button"
              disabled={isBusy || unlockSnapWei === undefined}
              onClick={handleUnlock}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-400/40 bg-gradient-to-br from-indigo-500/30 to-sky-500/20 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(99,102,241,0.2)] transition hover:border-indigo-300/60 hover:from-indigo-500/40 disabled:opacity-50"
            >
              <span>
                Unlock · {unlockMusdLabel}{" "}
                <MusdInlineIcon className="inline" decorative />
              </span>
            </button>
          </div>
        ) : null}
      </div>

      <div className="px-4 pb-5 pt-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-5">
            <button
              type="button"
              className={`flex items-center gap-2 border-0 bg-transparent p-0 transition hover:opacity-90 active:opacity-75 disabled:pointer-events-none disabled:opacity-35 ${likedUi ? "text-red-500" : "text-white"}`}
              aria-label={
                hasTipped ? "Already tipped" : "Like — tip 0.01 MUSD worth of SNAP"
              }
              disabled={isBusy || hasTipped || likePressed || tipSnapWei === undefined}
              onClick={() => void handleLikeTip()}
            >
              <Heart
                className={`h-6 w-6 shrink-0 ${likedUi ? "fill-red-500 stroke-red-500 text-red-500" : ""}`}
                strokeWidth={1.5}
              />
              <span className="text-sm font-normal tabular-nums tracking-tight">
                {likeCount}
              </span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2 border-0 bg-transparent p-0 text-white transition hover:opacity-85 active:opacity-70 disabled:pointer-events-none disabled:opacity-35"
              aria-label="Comments"
              disabled={isBusy}
              onClick={() => setCommentOpen(true)}
            >
              <MessageCircle className="h-6 w-6 shrink-0" strokeWidth={1.5} />
              <span className="text-sm font-normal tabular-nums tracking-tight">
                {commentCount}
              </span>
            </button>
          </div>
          <div className="max-w-[52%] overflow-x-auto pt-0.5 text-right text-[10px] font-normal tracking-wide text-zinc-500">
            <div className="whitespace-nowrap">
            <span className="text-zinc-400">Like</span>{" "}
            <span className="inline-flex items-center gap-0.5 font-medium text-zinc-200">
              0.01 <MusdInlineIcon decorative />
            </span>
            <span className="text-zinc-600"> · </span>
            <span className="text-zinc-400">Reply</span>{" "}
            <span className="inline-flex items-center gap-0.5 font-medium text-zinc-200">
              0.01 <MusdInlineIcon decorative />
            </span>
            {isLockedPost ? (
              <>
                <span className="text-zinc-600"> · </span>
                <span className="text-zinc-400">Unlock</span>{" "}
                <span className="inline-flex items-center gap-0.5 font-medium text-zinc-200">
                  {unlockMusdLabel} <MusdInlineIcon decorative />
                </span>
              </>
            ) : null}
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div className="flex shrink-0 -space-x-1.5 pl-0.5">
            {post.likedBySeeds.map((seed, i) => (
              <div
                key={seed}
                className="relative h-[18px] w-[18px] overflow-hidden rounded-full ring-[1.5px] ring-[#0c1018]"
                style={{ zIndex: post.likedBySeeds.length - i }}
              >
                <Image
                  src={picsumAvatar(seed, 48)}
                  alt=""
                  width={18}
                  height={18}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
          <p className="min-w-0 text-xs leading-snug text-zinc-400">
            <span className="font-semibold text-zinc-300">Liked by</span>{" "}
            <span className="font-bold text-white">others</span>
          </p>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          <span className="font-semibold text-white">{post.userName}</span>{" "}
          {post.caption}
        </p>
      </div>

      {commentOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60 backdrop-blur-[2px]"
              role="presentation"
              onClick={() => !isBusy && setCommentOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelId}
                aria-describedby={commentSheetContextId}
                className="mx-auto flex h-[min(88dvh,640px)] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[22px] border border-white/10 border-b-0 bg-[#0b0f18] shadow-[0_-16px_56px_rgba(0,0,0,0.55)]"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && !isBusy) {
                    setCommentOpen(false);
                  }
                }}
              >
                <div className="shrink-0 px-4 pb-3 pt-3">
                  <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/25" />
                  <div
                    id={commentSheetContextId}
                    className="flex gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3"
                  >
                    {showLockOverlay ? (
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-900/90 ring-1 ring-white/10"
                        aria-hidden
                      >
                        <Lock
                          className="h-6 w-6 text-zinc-500"
                          strokeWidth={1.5}
                        />
                      </div>
                    ) : (
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10">
                        <Image
                          src={src}
                          alt=""
                          width={56}
                          height={56}
                          className="h-14 w-14 object-cover"
                          sizes="56px"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        Post
                      </p>
                      <p className="truncate text-sm font-semibold text-white">
                        {post.userName}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        @{post.userHandle} · {post.timeAgo}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-snug text-zinc-400">
                        {post.caption}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <h2
                      id={labelId}
                      className="text-base font-semibold tracking-tight text-white"
                    >
                      Comments{" "}
                      <span className="text-sm font-normal tabular-nums text-zinc-500">
                        ({post.comments + comments.length})
                      </span>
                    </h2>
                    <button
                      type="button"
                      disabled={isBusy}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
                      aria-label="Close comments"
                      onClick={() => setCommentOpen(false)}
                    >
                      <X className="h-[18px] w-[18px]" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
                  {comments.length === 0 ? (
                    <p className="py-10 text-center text-sm font-normal leading-relaxed text-zinc-500">
                      No comments yet.
                      <br />
                      <span className="text-xs text-zinc-600">
                        Be the first to say something.
                      </span>
                    </p>
                  ) : (
                    <ul className="space-y-1 pb-3">
                      {comments.map((c) => (
                        <li key={c.id} className="flex gap-3 py-2.5">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/90 to-violet-600/80 text-[10px] font-bold text-white ring-1 ring-white/15">
                            You
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-snug text-zinc-100">
                              <span className="font-semibold text-white">You</span>{" "}
                              <span className="font-normal text-zinc-200">
                                {c.text}
                              </span>
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                              <span>{formatShortTime(c.at)}</span>
                              <span aria-hidden>·</span>
                              <a
                                className="font-medium text-zinc-400 transition hover:text-white"
                                href={`${mezoTestnet.blockExplorers.default.url}/tx/${c.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View transaction
                              </a>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="shrink-0 border-t border-white/[0.08] bg-[#0b0f18] px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2">
                  <p className="mb-2 flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-center text-[10px] font-medium tracking-wide text-zinc-500">
                    <span>Posting sends</span>
                    <span className="inline-flex items-center gap-0.5 text-zinc-200">
                      0.01 <MusdInlineIcon decorative />
                    </span>
                    <span className="inline-flex items-center gap-0 text-violet-200/90">
                      (~{tipSnapLabel}
                      <SnapInlineIcon decorative />
                      {"SNAP)"}
                    </span>
                    <span>on-chain</span>
                  </p>
                  <div className="flex items-end gap-2">
                    <div
                      className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800/90 ring-1 ring-white/10"
                      aria-hidden
                    >
                      {address ? (
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-tighter text-zinc-300">
                          {address.slice(2, 4)}
                        </span>
                      ) : (
                        <UserRound className="h-4 w-4 text-zinc-500" strokeWidth={1.5} />
                      )}
                    </div>
                    <label className="sr-only" htmlFor={`snapzo-comment-${post.id}`}>
                      Add a comment
                    </label>
                    <textarea
                      id={`snapzo-comment-${post.id}`}
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      rows={1}
                      maxLength={500}
                      placeholder="Add a comment…"
                      disabled={isBusy}
                      className="max-h-28 min-h-[42px] flex-1 resize-none rounded-[22px] border border-white/10 bg-zinc-950/80 px-4 py-2.5 text-sm leading-snug text-white placeholder:text-zinc-500 outline-none transition focus:border-white/20 focus:ring-1 focus:ring-white/15 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={isBusy || !commentDraft.trim() || tipSnapWei === undefined}
                      onClick={handleSubmitComment}
                      className="mb-1 shrink-0 px-2 py-1.5 text-sm font-semibold text-[#0095f6] transition enabled:hover:text-[#47b8ff] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      Post
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </article>
  );
}
