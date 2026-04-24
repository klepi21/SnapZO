"use client";

import Image from "next/image";
import Link from "next/link";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Heart, Lock, MessageCircle, UserRound, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSignTypedData,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import {
  encodeAbiParameters,
  formatUnits,
  keccak256,
  maxUint256,
  parseUnits,
  stringToBytes,
  UserRejectedRequestError,
} from "viem";
import type { FeedPost } from "@/lib/dummy/social";
import { picsumAvatar } from "@/lib/dummy/social";
import { SnapInlineIcon } from "@/components/icons/snap-inline-icon";
import { MUSD_DECIMALS } from "@/lib/constants/musd";
import {
  erc20TotalSupplyAbi,
  isSnapZoHubConfigured,
  isSnapZoSocialConfigured,
  SNAP_DECIMALS,
  SNAPZO_HUB_ADDRESS,
  SNAPZO_SOCIAL_ADDRESS,
  SNAPZO_SNAP_TOKEN_ADDRESS,
  snapZoHubAbi,
} from "@/lib/constants/snapzo-hub";
import { erc20AllowanceAbi, erc20ApproveAbi } from "@/lib/constants/mezo-dex";
import { mezoTestnet } from "@/lib/chains/mezo-testnet";
import { musdWeiToSnapBaseUnitsCeil } from "@/lib/snapzo/musd-snap-quote";
import {
  createSocialUnlockRecord,
  createTipRecord,
  createSocialReplyRequestRecord,
  fetchPostByPostId,
  fetchTipsForPost,
  fetchSocialRepliesForPost,
  fulfillSocialReplyRecord,
  type SocialReplyItem,
  type TipItem,
} from "@/lib/snapzo-api";
import { useSnapzoToast } from "@/components/providers/snapzo-toast-provider";
import { ipfsGatewayUrl } from "@/lib/snapzo-profile-local";

interface PostCardProps {
  post: FeedPost;
}

/** Fixed MUSD-quoted like/reply; unlock now uses direct SNAP amount from post price. */
const TIP_MUSD_WEI = parseUnits("0.01", MUSD_DECIMALS);
const DEFAULT_UNLOCK_MUSD = 0.1;
const SNAPZO_SOCIAL_TIP_TYPES = {
  Tip: [
    { name: "tipper", type: "address" },
    { name: "postId", type: "uint256" },
    { name: "creator", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;
const SNAPZO_SOCIAL_UNLOCK_TYPES = {
  Unlock: [
    { name: "unlocker", type: "address" },
    { name: "postId", type: "uint256" },
    { name: "creator", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;
const SNAPZO_SOCIAL_REPLY_DEPOSIT_TYPES = {
  ReplyDeposit: [
    { name: "payer", type: "address" },
    { name: "postId", type: "uint256" },
    { name: "creator", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;
const SNAPZO_SOCIAL_FULFILL_REPLY_TYPES = {
  FulfillReply: [
    { name: "creator", type: "address" },
    { name: "requestId", type: "bytes32" },
    { name: "commentId", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;
const SNAPZO_SOCIAL_NONCES_ABI = [
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

interface PendingSocialReply {
  requestId: `0x${string}`;
  payer: `0x${string}`;
  amount: bigint;
  refundNotBefore: bigint;
}

const SNAPZO_SOCIAL_REDEPLOY_BLOCK = BigInt(12_538_413);
const ZERO = BigInt(0);

function unlockSnapWeiFromPost(post: FeedPost): bigint {
  const human = post.unlockPriceMusd;
  if (human === undefined || !Number.isFinite(human) || human <= 0) {
    return parseUnits(String(DEFAULT_UNLOCK_MUSD), SNAP_DECIMALS);
  }
  const s = human.toFixed(12).replace(/\.?0+$/, "") || String(DEFAULT_UNLOCK_MUSD);
  try {
    return parseUnits(s, SNAP_DECIMALS);
  } catch {
    return parseUnits(String(DEFAULT_UNLOCK_MUSD), SNAP_DECIMALS);
  }
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
  const { signTypedDataAsync, isPending: isSignPending } = useSignTypedData();
  const publicClient = usePublicClient({ chainId: mezoTestnet.id });
  const toast = useSnapzoToast();

  const hubConfigured = isSnapZoHubConfigured();
  const socialConfigured = isSnapZoSocialConfigured();
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

  const socialSnapTokenRead = useReadContract({
    chainId: mezoTestnet.id,
    address: SNAPZO_SOCIAL_ADDRESS,
    abi: [
      {
        type: "function",
        name: "snapToken",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "address" }],
      },
    ] as const,
    functionName: "snapToken",
    query: { enabled: socialConfigured, staleTime: 60_000 },
  });
  const socialSnapTokenAddress =
    socialSnapTokenRead.data ?? SNAPZO_SNAP_TOKEN_ADDRESS;
  const likeTipAmountRead = useReadContract({
    chainId: mezoTestnet.id,
    address: SNAPZO_SOCIAL_ADDRESS,
    abi: [{ type: "function", name: "likeTipAmount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }] as const,
    functionName: "likeTipAmount",
    query: { enabled: socialConfigured, staleTime: 10_000 },
  });
  const replyStakeAmountRead = useReadContract({
    chainId: mezoTestnet.id,
    address: SNAPZO_SOCIAL_ADDRESS,
    abi: [
      {
        type: "function",
        name: "replyStakeAmount",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "uint256" }],
      },
    ] as const,
    functionName: "replyStakeAmount",
    query: { enabled: socialConfigured, staleTime: 10_000 },
  });
  const allowanceRead = useReadContract({
    chainId: mezoTestnet.id,
    address: socialSnapTokenAddress,
    abi: erc20AllowanceAbi,
    functionName: "allowance",
    args: address ? [address, SNAPZO_SOCIAL_ADDRESS] : undefined,
    query: { enabled: Boolean(address && socialConfigured), staleTime: 10_000 },
  });
  const socialTokenBalanceRead = useReadContract({
    chainId: mezoTestnet.id,
    address: socialSnapTokenAddress,
    abi: [
      {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ type: "uint256" }],
      },
    ] as const,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && socialConfigured), staleTime: 10_000 },
  });
  const allowanceValue = allowanceRead.data ?? BigInt(0);
  const refetchAllowance = allowanceRead.refetch;
  const socialTokenBalance = socialTokenBalanceRead.data ?? BigInt(0);

  const unlockSnapWei = useMemo(() => unlockSnapWeiFromPost(post), [post]);

  const tipSnapWei = useMemo(() => {
    if (ta === undefined || ts === undefined || ta <= BigInt(0)) {
      return undefined;
    }
    const v = musdWeiToSnapBaseUnitsCeil(TIP_MUSD_WEI, ts, ta);
    return v > BigInt(0) ? v : undefined;
  }, [ta, ts]);

  const replyStakeAmount = replyStakeAmountRead.data;
  const likeTipAmount = likeTipAmountRead.data;
  const replyStakeLabel =
    replyStakeAmount !== undefined
      ? formatUnitsMax2dp(replyStakeAmount, SNAP_DECIMALS)
      : "…";
  const unlockSnapLabel =
    unlockSnapWei !== undefined ? formatUnitsMax2dp(unlockSnapWei, SNAP_DECIMALS) : "…";

  const isLockedPost = Boolean(post.contentLocked);
  const isSubscriberOnlyLocked = Boolean(
    post.visibility === "subscriber_only" && post.subscriberOnlyLocked,
  );
  const [optimisticUnlocked, setOptimisticUnlocked] = useState(false);
  const [dbHasTipped, setDbHasTipped] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>();
  const [pendingKind, setPendingKind] = useState<
    "unlock" | "like" | "replyRequest" | "replyFulfill" | null
  >(null);
  const [pendingCommentText, setPendingCommentText] = useState<string | null>(
    null,
  );
  const [pendingRequestId, setPendingRequestId] = useState<`0x${string}` | null>(
    null
  );
  const [pendingCommentId, setPendingCommentId] = useState<bigint | null>(null);
  const [replyTargetRequestId, setReplyTargetRequestId] = useState<`0x${string}` | null>(
    null
  );
  /** True after user initiates like until tx fails or is superseded by storage. */
  const [likePressed, setLikePressed] = useState(false);
  const lastMediaTapRef = useRef(0);
  const [pendingSocialReplies, setPendingSocialReplies] = useState<
    PendingSocialReply[]
  >([]);
  const [dbReplies, setDbReplies] = useState<SocialReplyItem[]>([]);
  const [dbTips, setDbTips] = useState<TipItem[]>([]);
  const [displayImageUrl, setDisplayImageUrl] = useState(post.imageUrl);
  const [mediaRatio, setMediaRatio] = useState<number | null>(null);

  const { isLoading: isConfirming, isSuccess, isError } =
    useWaitForTransactionReceipt({
      hash: pendingHash,
      chainId: mezoTestnet.id,
      query: { enabled: Boolean(pendingHash) },
    });

  const isOwnPost = Boolean(
    address && post.tipRecipient.toLowerCase() === address.toLowerCase()
  );
  const mediaUnlocked = !isLockedPost || isOwnPost || Boolean(post.unlockedByMe) || optimisticUnlocked;
  const hasTipped = dbHasTipped;
  const comments = dbReplies;
  const pendingDbReplies = useMemo(
    () => dbReplies.filter((r) => r.status === "pending"),
    [dbReplies]
  );

  useEffect(() => {
    setDisplayImageUrl(post.imageUrl);
  }, [post.imageUrl, post.id]);
  useEffect(() => {
    setMediaRatio(null);
  }, [post.id, post.imageUrl]);
  useEffect(() => {
    if (!displayImageUrl) return;
    let cancelled = false;
    const probe = new window.Image();
    probe.onload = () => {
      if (cancelled) return;
      if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
        setMediaRatio(probe.naturalWidth / probe.naturalHeight);
      }
    };
    probe.src = displayImageUrl;
    return () => {
      cancelled = true;
    };
  }, [displayImageUrl]);

  const src = displayImageUrl;
  const showLockOverlay = isLockedPost && !mediaUnlocked && !isSubscriberOnlyLocked;
  const profileHref = `/profile?wallet=${(post.creatorWallet ?? post.tipRecipient).toLowerCase()}`;
  const fallbackRatio =
    post.imageWidth > 0 && post.imageHeight > 0
      ? post.imageWidth / post.imageHeight
      : 9 / 16;
  const resolvedRatio = mediaRatio ?? fallbackRatio;
  const clampedRatio = Math.min(1.8, Math.max(0.45, resolvedRatio));
  const mediaContainerClass =
    "relative mx-3 w-full touch-manipulation overflow-hidden rounded-[24px] bg-black ring-1 ring-white/[0.12]";
  const mediaObjectClass = "object-contain object-center";
  const socialPostId = useMemo(() => {
    const postIdDigest = keccak256(stringToBytes(post.id));
    return BigInt(`0x${postIdDigest.slice(2, 18)}`);
  }, [post.id]);

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
    let cancelled = false;
    async function loadDbReplies() {
      if (!post.postObjectId) return;
      const res = await fetchSocialRepliesForPost(post.postObjectId).catch(() => ({ items: [] }));
      if (!cancelled) setDbReplies(res.items);
    }
    void loadDbReplies();
    return () => {
      cancelled = true;
    };
  }, [post.postObjectId]);

  useEffect(() => {
    let cancelled = false;
    async function loadDbTips() {
      if (!post.postObjectId) return;
      const res = await fetchTipsForPost(post.postObjectId, address).catch(() => ({
        items: [],
        hasViewerTipped: false,
      }));
      if (!cancelled) {
        setDbTips(res.items);
        setDbHasTipped(res.hasViewerTipped);
      }
    }
    void loadDbTips();
    return () => {
      cancelled = true;
    };
  }, [post.postObjectId, address]);

  useEffect(() => {
    let cancelled = false;
    async function loadPendingSocialReplies() {
      if (!publicClient || !socialConfigured || !address || !isOwnPost) {
        if (!cancelled) setPendingSocialReplies([]);
        return;
      }
      const creator = address.toLowerCase() as `0x${string}`;
      const logs = await publicClient
        .getLogs({
          address: SNAPZO_SOCIAL_ADDRESS,
          event: {
            type: "event",
            name: "ReplyDeposited",
            inputs: [
              { name: "requestId", type: "bytes32", indexed: true },
              { name: "payer", type: "address", indexed: true },
              { name: "creator", type: "address", indexed: true },
              { name: "postId", type: "uint256", indexed: false },
              { name: "amount", type: "uint256", indexed: false },
              { name: "refundNotBefore", type: "uint48", indexed: false },
              { name: "relayer", type: "address", indexed: false },
            ],
          },
          args: { creator },
          fromBlock: SNAPZO_SOCIAL_REDEPLOY_BLOCK,
          toBlock: "latest",
        })
        .catch(() => []);
      const matched = logs.filter((log) => (log.args.postId as bigint) === socialPostId);
      const lockChecks = await Promise.all(
        matched.map(async (log) => {
          const requestId = log.args.requestId as `0x${string}`;
          const lock = await publicClient
            .readContract({
              address: SNAPZO_SOCIAL_ADDRESS,
              abi: [
                {
                  type: "function",
                  name: "replyLocks",
                  stateMutability: "view",
                  inputs: [{ name: "", type: "bytes32" }],
                  outputs: [
                    { name: "requester", type: "address" },
                    { name: "creator", type: "address" },
                    { name: "postId", type: "uint256" },
                    { name: "amount", type: "uint256" },
                    { name: "refundNotBefore", type: "uint48" },
                    { name: "fulfilled", type: "bool" },
                  ],
                },
              ] as const,
              functionName: "replyLocks",
              args: [requestId],
            })
            .catch(() => null);
          if (!lock || lock[5]) return null;
          return {
            requestId,
            payer: lock[0] as `0x${string}`,
            amount: lock[3],
            refundNotBefore: BigInt(lock[4]),
          } satisfies PendingSocialReply;
        })
      );
      if (!cancelled) {
        setPendingSocialReplies(
          lockChecks.filter((v): v is PendingSocialReply => v !== null)
        );
      }
    }
    void loadPendingSocialReplies();
    const id = setInterval(() => void loadPendingSocialReplies(), 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address, isOwnPost, publicClient, socialConfigured, socialPostId]);

  useEffect(() => {
    if (!pendingHash || !isSuccess || !pendingKind) {
      return;
    }
    async function handleSuccess() {
      const confirmedHash = pendingHash;
      if (!confirmedHash) return;
      if (pendingKind === "unlock") {
        setOptimisticUnlocked(true);
        if (address && post.postObjectId && unlockSnapWei !== undefined) {
          await createSocialUnlockRecord({
            postObjectId: post.postObjectId,
            userWallet: address,
            txHash: confirmedHash,
            amountWei: unlockSnapWei.toString(),
          }).catch(() => null);
          const refreshed = await fetchPostByPostId(post.id, { viewer: address }).catch(() => null);
          const unlockedCid = refreshed?.ipfsHash?.trim();
          if (unlockedCid) {
            setDisplayImageUrl(ipfsGatewayUrl(unlockedCid));
          }
        }
        toast(unlockSnapWei !== undefined ? `Unlocked · ${unlockSnapLabel} SNAP` : "Unlocked.");
      } else if (pendingKind === "like") {
        setDbHasTipped(true);
        if (address && likeTipAmountRead.data !== undefined) {
          await createTipRecord({
            postId: post.id,
            fromWallet: address,
            amount: Number(formatUnits(likeTipAmountRead.data, SNAP_DECIMALS)),
            txHash: confirmedHash,
          }).catch(() => null);
        }
        if (post.postObjectId) {
          const refreshedTips = await fetchTipsForPost(post.postObjectId, address).catch(
            () => ({ items: [], hasViewerTipped: true })
          );
          setDbTips(refreshedTips.items);
          setDbHasTipped(refreshedTips.hasViewerTipped);
        }
        toast(
          tipSnapWei !== undefined
            ? `Sent tip · 0.01 MUSD (~${formatUnitsMax2dp(tipSnapWei, SNAP_DECIMALS)} SNAP)`
            : "Tip sent.",
        );
      } else if (
        (pendingKind === "replyRequest" || pendingKind === "replyFulfill") &&
        pendingCommentText
      ) {
        const trimmed = pendingCommentText.trim();
        if (trimmed) {
          if (pendingKind === "replyRequest" && pendingRequestId && address) {
            await createSocialReplyRequestRecord({
              postObjectId: post.postObjectId ?? post.id,
              requestId: pendingRequestId,
              socialPostId: socialPostId.toString(),
              requesterWallet: address,
              creatorWallet: post.tipRecipient,
              stakeAmountWei: (replyStakeAmountRead.data ?? BigInt(0)).toString(),
              requestTxHash: confirmedHash,
              requesterComment: trimmed,
            }).catch(() => null);
          }
          if (
            pendingKind === "replyFulfill" &&
            address &&
            pendingRequestId &&
            pendingCommentId !== null
          ) {
            await fulfillSocialReplyRecord({
              requestId: pendingRequestId,
              creatorWallet: address,
              creatorReply: trimmed,
              commentId: pendingCommentId.toString(),
              fulfillTxHash: confirmedHash,
            }).catch(() => null);
          }
          const refreshed = await fetchSocialRepliesForPost(post.postObjectId ?? post.id).catch(() => ({ items: [] }));
          setDbReplies(refreshed.items);
          setCommentDraft("");
          if (pendingKind === "replyFulfill") {
            toast("Reply sent · escrow released to creator.");
          } else {
            toast(`Reply request submitted · ${replyStakeLabel} SNAP escrowed.`);
          }
        }
        setPendingCommentText(null);
      }
      if (pendingKind === "like") {
        setLikePressed(false);
      }
      setPendingHash(undefined);
      setPendingKind(null);
      setPendingRequestId(null);
      setPendingCommentId(null);
      setReplyTargetRequestId(null);
    }
    void handleSuccess();
  }, [
    isSuccess,
    pendingHash,
    pendingKind,
    pendingCommentText,
    pendingRequestId,
    pendingCommentId,
    address,
    post.id,
    post.postObjectId,
    post.tipRecipient,
    socialPostId,
    replyStakeAmountRead.data,
    tipSnapWei,
    replyStakeLabel,
    unlockSnapWei,
    likeTipAmountRead.data,
    toast,
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
    setPendingRequestId(null);
    setPendingCommentId(null);
    setReplyTargetRequestId(null);
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

  const isBusy = isWritePending || isSignPending || isConfirming || Boolean(pendingHash);

  const showGetSnapToast = useCallback(() => {
    toast({
      title: "You need SNAP to continue",
      subtitle: "Get SNAP first, then try like, reply, or unlock.",
      link: { href: "/earn", label: "Get SNAP on Earn" },
    });
  }, [toast]);

  const readFreshSocialNonce = useCallback(
    async (user: `0x${string}`): Promise<bigint> => {
      if (!publicClient) {
        throw new Error("Social client unavailable. Retry in a moment.");
      }
      const chainNonce = await publicClient.readContract({
        address: SNAPZO_SOCIAL_ADDRESS,
        abi: SNAPZO_SOCIAL_NONCES_ABI,
        functionName: "nonces",
        args: [user],
      });
      return chainNonce;
    },
    [publicClient],
  );

  const relayPostJson = useCallback(
    async (
      url: string,
      body: Record<string, string>,
    ): Promise<{ hash?: `0x${string}`; error?: string; code?: string; latestNonce?: string }> => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        hash?: `0x${string}`;
        error?: string;
        code?: string;
        latestNonce?: string;
      };
      if (!res.ok || !payload.hash) {
        const err = new Error(payload.error || "Social relay failed") as Error & {
          relayCode?: string;
          relayLatestNonce?: string;
        };
        err.relayCode = payload.code;
        err.relayLatestNonce = payload.latestNonce;
        throw err;
      }
      return payload;
    },
    [],
  );

  const likedUi = hasTipped || likePressed;
  const likeCount = dbTips.length + (likePressed ? 1 : 0);
  const commentCount = comments.length;
  const recentLikers = useMemo(() => dbTips.slice(0, 3), [dbTips]);

  const handleUnlock = async () => {
    if (!isLockedPost || mediaUnlocked) {
      return;
    }
    if (!ensureMezo()) {
      return;
    }
    if (!socialConfigured) {
      toast("SnapZo social contract is not configured.", "error");
      return;
    }
    if (unlockSnapWei === undefined) {
      toast("Pricing unavailable right now. Retry in a moment.", "error");
      return;
    }
    if (socialSnapTokenAddress === undefined) {
      toast("Social token address unavailable. Retry in a moment.", "error");
      return;
    }
    if (socialTokenBalance <= ZERO || socialTokenBalance < unlockSnapWei) {
      showGetSnapToast();
      return;
    }
    try {
      if (allowanceValue < unlockSnapWei) {
        toast("Approve SNAP for SnapZoSocial…");
        await writeContractAsync({
          address: socialSnapTokenAddress,
          abi: erc20ApproveAbi,
          functionName: "approve",
          args: [SNAPZO_SOCIAL_ADDRESS, maxUint256],
          chainId: mezoTestnet.id,
        });
        await refetchAllowance();
      }

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
      const signAndRelayUnlock = async (nonceValue: bigint) => {
        toast(`Sign unlock · ${unlockSnapLabel} SNAP…`);
        const signature = await signTypedDataAsync({
          domain: {
            name: "SnapZoSocial",
            version: "1",
            chainId: mezoTestnet.id,
            verifyingContract: SNAPZO_SOCIAL_ADDRESS,
          },
          types: SNAPZO_SOCIAL_UNLOCK_TYPES,
          primaryType: "Unlock",
          message: {
            unlocker: address as `0x${string}`,
            postId: socialPostId,
            creator: post.tipRecipient,
            amount: unlockSnapWei,
            nonce: nonceValue,
            deadline,
          },
        });
        toast("Submitting unlock through social relayer…");
        return relayPostJson("/api/snapzo/social/relay-unlock", {
          unlocker: String(address),
          postId: String(socialPostId),
          creator: post.tipRecipient,
          amount: String(unlockSnapWei),
          nonce: String(nonceValue),
          deadline: String(deadline),
          signature,
        });
      };

      const freshNonce = await readFreshSocialNonce(address as `0x${string}`);
      let payload = await signAndRelayUnlock(freshNonce).catch(async (error) => {
        const err = error as Error & { relayCode?: string; relayLatestNonce?: string };
        if (err.relayCode !== "BAD_NONCE") throw err;
        const retryNonce = err.relayLatestNonce
          ? BigInt(err.relayLatestNonce)
          : await readFreshSocialNonce(address as `0x${string}`);
        toast("Nonce changed on-chain. Please sign once more…");
        return signAndRelayUnlock(retryNonce);
      });

      if (!payload.hash) {
        throw new Error(payload.error || "Unlock relay failed");
      }
      setPendingKind("unlock");
      setPendingHash(payload.hash);
      toast("Confirming on Mezo…");
    } catch (e) {
      toast(formatTxError(e), "error");
    }
  };

  const handleLikeTip = useCallback(async () => {
    if (hasTipped || likePressed) {
      return;
    }
    if (isOwnPost) {
      toast("You can't like your own post.", "error");
      return;
    }
    if (!ensureMezo()) {
      return;
    }
    if (!socialConfigured) {
      toast("SnapZo social contract is not configured.", "error");
      return;
    }
    const likeTipAmount = likeTipAmountRead.data;
    if (
      !socialConfigured ||
      likeTipAmount === undefined
    ) {
      toast("Social tip config unavailable. Retry in a moment.", "error");
      return;
    }
    if (socialSnapTokenAddress === undefined) {
      toast("Social token address unavailable. Retry in a moment.", "error");
      return;
    }
    if (socialTokenBalance <= ZERO || socialTokenBalance < likeTipAmount) {
      showGetSnapToast();
      return;
    }
    setLikePressed(true);
    try {
      if (socialTokenBalance < likeTipAmount) {
        throw new Error(
          `Insufficient SNAP for social tip. Need ${formatUnits(
            likeTipAmount,
            SNAP_DECIMALS
          )} SNAP.`
        );
      }
      if (allowanceValue < likeTipAmount) {
        toast("Approve SNAP for SnapZoSocial…");
        await writeContractAsync({
          address: socialSnapTokenAddress,
          abi: erc20ApproveAbi,
          functionName: "approve",
          args: [SNAPZO_SOCIAL_ADDRESS, maxUint256],
          chainId: mezoTestnet.id,
        });
        await refetchAllowance();
      }

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
      const signAndRelayTip = async (nonceValue: bigint) => {
        toast(`Sign social tip · ${formatUnits(likeTipAmount, SNAP_DECIMALS)} SNAP…`);
        const signature = await signTypedDataAsync({
          domain: {
            name: "SnapZoSocial",
            version: "1",
            chainId: mezoTestnet.id,
            verifyingContract: SNAPZO_SOCIAL_ADDRESS,
          },
          types: SNAPZO_SOCIAL_TIP_TYPES,
          primaryType: "Tip",
          message: {
            tipper: address as `0x${string}`,
            postId: socialPostId,
            creator: post.tipRecipient,
            nonce: nonceValue,
            deadline,
          },
        });

        toast("Submitting through social relayer…");
        return relayPostJson("/api/snapzo/social/relay-tip", {
          tipper: String(address),
          postId: String(socialPostId),
          creator: post.tipRecipient,
          nonce: String(nonceValue),
          deadline: String(deadline),
          signature,
        });
      };

      const freshNonce = await readFreshSocialNonce(address as `0x${string}`);
      const payload = await signAndRelayTip(freshNonce).catch(async (error) => {
        const err = error as Error & { relayCode?: string; relayLatestNonce?: string };
        if (err.relayCode !== "BAD_NONCE") throw err;
        const retryNonce = err.relayLatestNonce
          ? BigInt(err.relayLatestNonce)
          : await readFreshSocialNonce(address as `0x${string}`);
        toast("Nonce changed on-chain. Please sign once more…");
        return signAndRelayTip(retryNonce);
      });
      if (!payload.hash) {
        throw new Error(payload.error || "Social relay failed");
      }
      setPendingKind("like");
      setPendingHash(payload.hash);
      toast("Confirming on Mezo…");
    } catch (e) {
      setLikePressed(false);
      toast(formatTxError(e), "error");
    }
  }, [
    ensureMezo,
    hasTipped,
    likePressed,
    isOwnPost,
    socialConfigured,
    socialSnapTokenAddress,
    post.tipRecipient,
    post.id,
    likeTipAmountRead.data,
    socialTokenBalance,
    showGetSnapToast,
    allowanceValue,
    refetchAllowance,
    readFreshSocialNonce,
    relayPostJson,
    address,
    signTypedDataAsync,
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
    if (!socialConfigured) {
      toast("SnapZo social contract is not configured.", "error");
      return;
    }
    if (isOwnPost) {
      const selected =
        (replyTargetRequestId
          ? pendingDbReplies.find((r) => r.requestId === replyTargetRequestId)
          : undefined) ?? pendingDbReplies[0];
      if (!selected) {
        toast("No pending paid replies to fulfill for this post.", "error");
        return;
      }
      const selectedRequestId = selected.requestId as `0x${string}`;
      const commentIdDigest = keccak256(
        stringToBytes(`${post.id}:${text}:${Date.now().toString()}`)
      );
      const commentId = BigInt(`0x${commentIdDigest.slice(2, 18)}`);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
      setPendingCommentText(text);
      setPendingRequestId(selectedRequestId);
      setPendingCommentId(commentId);
      const signAndRelayFulfill = async (nonceValue: bigint) => {
        toast("Sign creator reply to unlock escrow…");
        const signature = await signTypedDataAsync({
          domain: {
            name: "SnapZoSocial",
            version: "1",
            chainId: mezoTestnet.id,
            verifyingContract: SNAPZO_SOCIAL_ADDRESS,
          },
          types: SNAPZO_SOCIAL_FULFILL_REPLY_TYPES,
          primaryType: "FulfillReply",
          message: {
            creator: address as `0x${string}`,
            requestId: selectedRequestId,
            commentId,
            nonce: nonceValue,
            deadline,
          },
        });
        toast("Submitting creator fulfill through social relayer…");
        return relayPostJson("/api/snapzo/social/relay-fulfill-reply", {
          creator: String(address),
          requestId: selectedRequestId,
          commentId: String(commentId),
          nonce: String(nonceValue),
          deadline: String(deadline),
          signature,
        });
      };
      const freshNonce = await readFreshSocialNonce(address as `0x${string}`);
      const payload = await signAndRelayFulfill(freshNonce).catch(async (error) => {
        const err = error as Error & { relayCode?: string; relayLatestNonce?: string };
        if (err.relayCode !== "BAD_NONCE") throw err;
        const retryNonce = err.relayLatestNonce
          ? BigInt(err.relayLatestNonce)
          : await readFreshSocialNonce(address as `0x${string}`);
        toast("Nonce changed on-chain. Please sign once more…");
        return signAndRelayFulfill(retryNonce);
      });
      if (!payload.hash) {
        throw new Error(payload.error || "Reply fulfill relay failed");
      }
      setPendingKind("replyFulfill");
      setPendingHash(payload.hash);
      toast("Confirming on Mezo…");
      return;
    }

    const stake = replyStakeAmountRead.data;
    if (stake === undefined || stake <= BigInt(0)) {
      toast("Reply stake config unavailable. Retry in a moment.", "error");
      return;
    }
    if (socialTokenBalance <= ZERO || socialTokenBalance < stake) {
      showGetSnapToast();
      return;
    }
    try {
      if (allowanceValue < stake) {
        toast("Approve SNAP for SnapZoSocial…");
        await writeContractAsync({
          address: socialSnapTokenAddress,
          abi: erc20ApproveAbi,
          functionName: "approve",
          args: [SNAPZO_SOCIAL_ADDRESS, maxUint256],
          chainId: mezoTestnet.id,
        });
        await refetchAllowance();
      }

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
      const freshNonce = await readFreshSocialNonce(address as `0x${string}`);
      const requestId = keccak256(
        encodeAbiParameters(
          [
            { type: "uint256" },
            { type: "address" },
            { type: "uint256" },
            { type: "address" },
            { type: "address" },
            { type: "uint256" },
          ],
          [
            BigInt(mezoTestnet.id),
            SNAPZO_SOCIAL_ADDRESS,
            socialPostId,
            post.tipRecipient as `0x${string}`,
            address as `0x${string}`,
            freshNonce,
          ]
        )
      ) as `0x${string}`;

      setPendingCommentText(text);
      setPendingRequestId(requestId);
      setPendingCommentId(null);
      const signAndRelayReplyDeposit = async (nonceValue: bigint) => {
        toast(`Sign reply request · ${formatUnits(stake, SNAP_DECIMALS)} SNAP escrow…`);
        const signature = await signTypedDataAsync({
          domain: {
            name: "SnapZoSocial",
            version: "1",
            chainId: mezoTestnet.id,
            verifyingContract: SNAPZO_SOCIAL_ADDRESS,
          },
          types: SNAPZO_SOCIAL_REPLY_DEPOSIT_TYPES,
          primaryType: "ReplyDeposit",
          message: {
            payer: address as `0x${string}`,
            postId: socialPostId,
            creator: post.tipRecipient,
            nonce: nonceValue,
            deadline,
          },
        });
        toast("Submitting reply request through social relayer…");
        return relayPostJson("/api/snapzo/social/relay-reply-deposit", {
          payer: String(address),
          postId: String(socialPostId),
          creator: post.tipRecipient,
          nonce: String(nonceValue),
          deadline: String(deadline),
          signature,
        });
      };
      const payload = await signAndRelayReplyDeposit(freshNonce).catch(async (error) => {
        const err = error as Error & { relayCode?: string; relayLatestNonce?: string };
        if (err.relayCode !== "BAD_NONCE") throw err;
        const retryNonce = err.relayLatestNonce
          ? BigInt(err.relayLatestNonce)
          : await readFreshSocialNonce(address as `0x${string}`);
        toast("Nonce changed on-chain. Please sign once more…");
        return signAndRelayReplyDeposit(retryNonce);
      });
      if (!payload.hash) {
        throw new Error(payload.error || "Reply relay failed");
      }
      setPendingKind("replyRequest");
      setPendingHash(payload.hash);
      toast("Confirming on Mezo…");
    } catch (e) {
      setPendingCommentText(null);
      toast(formatTxError(e), "error");
    }
  };

  return (
    <article className="snapzo-card-primary mx-4 mb-6 overflow-visible transition-transform duration-300 ease-out hover:-translate-y-0.5">
      <div className="flex items-center gap-3 px-4 pb-3 pt-4.5">
        <Link href={profileHref} className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-fuchsia-300/40 ring-offset-1 ring-offset-[rgba(12,18,36,0.65)]">
          <Image
            src={post.avatarUrl ?? picsumAvatar(post.avatarSeed, 128)}
            alt=""
            width={44}
            height={44}
            className="h-full w-full object-cover"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={profileHref} className="block">
            <p className="truncate text-[15px] font-semibold tracking-tight text-white hover:text-fuchsia-200">
              {post.userName}
            </p>
          </Link>
          <p className="text-[11px] text-zinc-500">{post.timeAgo}</p>
        </div>
      </div>

      <div>
      <div
        className={mediaContainerClass}
        style={{ aspectRatio: String(clampedRatio) }}
        onDoubleClick={(e) => {
          e.preventDefault();
          handleMediaDoubleLike();
        }}
        onTouchEnd={handleMediaTouchEnd}
        role="presentation"
        title={showLockOverlay ? undefined : "Double-tap or double-click to like"}
      >
        {src ? (
          <Image
            src={src}
            alt=""
            fill
            className={`${mediaObjectClass} transition-[filter,transform] duration-500 ease-out ${
              showLockOverlay ? "scale-[1.04] blur-2xl" : "blur-0"
            }`}
            sizes="(max-width: 430px) 100vw, 382px"
            priority={post.id === "1"}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-xs text-zinc-500">
            {isSubscriberOnlyLocked ? "OnlySnaps subscribers only" : "Media unavailable"}
          </div>
        )}
        {isSubscriberOnlyLocked ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-black/78 via-black/44 to-black/24 px-6 text-center">
            <Lock className="h-9 w-9 text-fuchsia-100/90" strokeWidth={1.5} aria-hidden />
            <p className="text-sm font-semibold tracking-tight text-white">OnlySnaps Locked</p>
            <p className="max-w-[240px] text-xs leading-relaxed text-zinc-300">
              Subscribe to unlock this creator's premium wall.
            </p>
            <Link
              href={profileHref}
              className="snapzo-pressable inline-flex items-center justify-center rounded-2xl border border-fuchsia-300/45 bg-gradient-to-br from-fuchsia-500/28 to-violet-500/24 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(217,70,239,0.2)] hover:border-fuchsia-200/70 hover:from-fuchsia-500/38"
            >
              Subscribe on profile
            </Link>
          </div>
        ) : null}
        {showLockOverlay ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-black/76 via-black/42 to-black/22 px-6 text-center">
            <Lock className="h-9 w-9 text-white/90" strokeWidth={1.5} aria-hidden />
            <p className="text-sm font-semibold tracking-tight text-white">Hidden content</p>
            <button
              type="button"
              disabled={isBusy || unlockSnapWei === undefined}
              onClick={handleUnlock}
              className="snapzo-pressable inline-flex items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/40 bg-gradient-to-br from-fuchsia-500/26 to-violet-500/20 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(217,70,239,0.18)] hover:border-fuchsia-200/60 hover:from-fuchsia-500/36 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-1">
                Unlock ·
                {unlockSnapLabel}
                <SnapInlineIcon decorative />
              </span>
            </button>
          </div>
        ) : null}
        {isLockedPost && isOwnPost ? (
          <div className="pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-black/55 px-2 py-1 text-[10px] font-semibold text-amber-100 backdrop-blur-sm">
            <Lock className="h-3 w-3" strokeWidth={1.8} />
            Locked for others
          </div>
        ) : null}
      </div>
      </div>

      <div className="px-4 pb-5 pt-4">
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-5">
            <button
              type="button"
              className={`snapzo-pressable flex items-center gap-2 border-0 bg-transparent p-0 hover:opacity-90 active:opacity-75 disabled:pointer-events-none ${likedUi ? "text-red-500 disabled:text-red-500" : "text-white disabled:opacity-35"}`}
              aria-label={
                hasTipped ? "Already tipped" : "Like — tip 0.01 MUSD worth of SNAP"
              }
              disabled={
                isBusy ||
                hasTipped ||
                likePressed ||
                tipSnapWei === undefined ||
                isOwnPost
              }
              onClick={() => void handleLikeTip()}
            >
              <Heart
                className={`h-6 w-6 shrink-0 ${likedUi ? "fill-red-500 stroke-red-500 text-red-500" : ""}`}
                strokeWidth={1.5}
              />
              <span className="text-sm font-medium tabular-nums tracking-tight">
                {likeCount}
              </span>
            </button>
            <button
              type="button"
              className="snapzo-pressable flex items-center gap-2 border-0 bg-transparent p-0 text-white hover:opacity-85 active:opacity-70 disabled:pointer-events-none disabled:opacity-35"
              aria-label="Comments"
              disabled={isBusy}
              onClick={() => setCommentOpen(true)}
            >
              <MessageCircle className="h-6 w-6 shrink-0" strokeWidth={1.5} />
              <span className="text-sm font-medium tabular-nums tracking-tight">
                {commentCount}
              </span>
            </button>
            <div className="inline-flex items-center gap-1 rounded-full border border-white/[0.09] bg-white/[0.03] px-2 py-1 text-[11px] text-zinc-300">
              <Lock className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.7} />
              <span className="tabular-nums">{post.unlockCount ?? 0}</span>
            </div>
          </div>
        </div>

        {recentLikers.length > 0 ? (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex shrink-0 -space-x-1.5 pl-0.5">
              {recentLikers.map((tip, i) => (
                <div
                  key={tip.id}
                  className="relative h-[18px] w-[18px] overflow-hidden rounded-full ring-[1.5px] ring-[#0c1018]"
                  style={{ zIndex: recentLikers.length - i }}
                >
                  {tip.tipperProfileImage ? (
                    <Image
                      src={ipfsGatewayUrl(tip.tipperProfileImage)}
                      alt=""
                      width={18}
                      height={18}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-zinc-700 text-[8px] font-semibold text-zinc-100">
                      {tip.fromWallet.slice(2, 4).toUpperCase()}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="min-w-0 text-xs leading-snug text-zinc-400">
              <span className="font-semibold text-zinc-300">Liked by</span>{" "}
              <span className="font-bold text-white">
                {recentLikers[0]?.tipperDisplayName?.trim() ||
                  recentLikers[0]?.tipperUsername?.trim() ||
                  `${recentLikers[0]?.fromWallet.slice(0, 6)}...${recentLikers[0]?.fromWallet.slice(-4)}`}
              </span>
              {likeCount > 1 ? <span>{` and ${likeCount - 1} others`}</span> : null}
            </p>
          </div>
        ) : null}

        <p className="mt-3 text-[14px] leading-relaxed text-zinc-300">
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
                className="mx-auto flex h-[min(88dvh,640px)] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[24px] border border-white/10 border-b-0 bg-[#0f1528] shadow-[0_-16px_56px_rgba(0,0,0,0.55)]"
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
                    className="flex gap-3 rounded-2xl border border-white/[0.1] bg-white/[0.05] p-3"
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
                    ) : src ? (
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
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-900/90 ring-1 ring-white/10 text-[10px] text-zinc-500">
                        No media
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
                    <h2 id={labelId} className="text-base font-semibold tracking-tight text-white">
                      Comments{" "}
                      <span className="text-sm font-normal tabular-nums text-zinc-500">
                        ({comments.length})
                      </span>
                    </h2>
                    {isOwnPost && pendingSocialReplies.length > 0 ? (
                      <span className="text-[11px] font-medium text-emerald-300">
                        {pendingDbReplies.length} pending paid repl{pendingDbReplies.length === 1 ? "y" : "ies"}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      disabled={isBusy}
                      className="snapzo-pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white/[0.08] hover:text-white"
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
                        <li key={c.id} className="flex gap-3 rounded-xl px-1 py-3">
                          <div className="mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-indigo-500/90 to-violet-600/80 ring-1 ring-white/15">
                            {c.requesterProfileImage ? (
                              <Image
                                src={ipfsGatewayUrl(c.requesterProfileImage)}
                                alt=""
                                width={32}
                                height={32}
                                className="h-8 w-8 object-cover"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center text-[10px] font-bold text-white">
                                {c.requesterWallet.slice(2, 4).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold leading-tight text-white">
                              {c.requesterDisplayName?.trim() ||
                                c.requesterUsername?.trim() ||
                                `${c.requesterWallet.slice(0, 6)}...${c.requesterWallet.slice(-4)}`}
                            </p>
                            <p className="mt-0.5 text-[14px] leading-[1.45] text-zinc-200">
                              {c.requesterComment}
                            </p>
                            {c.creatorReply ? (
                              <div className="mt-2 border-l border-emerald-400/35 pl-2.5">
                                <p className="text-[13px] leading-[1.4] text-emerald-200">
                                  <span className="font-semibold text-emerald-300">
                                    {(c.creatorDisplayName?.trim() || c.creatorUsername?.trim() || "Creator")}
                                  </span>
                                </p>
                                <p className="mt-0.5 text-[13px] leading-[1.4] text-emerald-100/95">
                                  {c.creatorReply}
                                </p>
                              </div>
                            ) : null}
                            <div className="mt-1.5 flex items-center gap-2 text-[10px] tracking-[0.01em] text-zinc-500">
                              <span>{c.createdAt ? formatShortTime(new Date(c.createdAt).getTime()) : "now"}</span>
                              <span aria-hidden>·</span>
                              <a
                                className="font-medium text-zinc-400 transition hover:text-zinc-200"
                                href={`${mezoTestnet.blockExplorers.default.url}/tx/${c.fulfillTxHash ?? c.requestTxHash}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View transaction
                              </a>
                              {isOwnPost && c.status === "pending" ? (
                                <>
                                  <span aria-hidden>·</span>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => {
                                      setReplyTargetRequestId(c.requestId as `0x${string}`);
                                      commentInputRef.current?.focus();
                                    }}
                                    className="font-semibold text-emerald-300 transition hover:text-emerald-200 disabled:opacity-40"
                                  >
                                    Reply
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="shrink-0 border-t border-white/[0.08] bg-[#0f1528] px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2">
                  <p className="mb-2 flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-center text-[10px] font-medium tracking-wide text-zinc-500">
                    <span>{isOwnPost ? "Creator reply unlocks" : "Reply request escrows"}</span>
                    <span className="inline-flex items-center gap-0.5 text-zinc-200">
                      {replyStakeLabel}
                      <SnapInlineIcon decorative />
                      {"SNAP"}
                    </span>
                    <span>{isOwnPost ? "from escrow" : "until creator fulfills"}</span>
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
                      ref={commentInputRef}
                      id={`snapzo-comment-${post.id}`}
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      rows={1}
                      maxLength={500}
                      placeholder={
                        isOwnPost && replyTargetRequestId
                          ? "Reply to selected paid comment…"
                          : "Add a comment…"
                      }
                      disabled={isBusy}
                      className="max-h-28 min-h-[42px] flex-1 resize-none rounded-[22px] border border-white/12 bg-[#090d1b]/90 px-4 py-2.5 text-sm leading-snug text-white placeholder:text-zinc-500 outline-none transition focus:border-fuchsia-300/35 focus:ring-1 focus:ring-fuchsia-300/20 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={isBusy || !commentDraft.trim() || replyStakeAmount === undefined}
                      onClick={handleSubmitComment}
                      className="snapzo-pressable mb-1 shrink-0 px-2 py-1.5 text-sm font-semibold text-[#0095f6] enabled:hover:text-[#47b8ff] disabled:cursor-not-allowed disabled:opacity-35"
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
