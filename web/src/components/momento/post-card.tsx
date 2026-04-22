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
import { MusdInlineIcon } from "@/components/icons/musd-inline-icon";
import { SnapInlineIcon } from "@/components/icons/snap-inline-icon";
import { erc20TransferAbi, MUSD_DECIMALS } from "@/lib/constants/musd";
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

/** Fixed MUSD-quoted like/reply; unlock uses per-post `unlockPriceMusd` (default 0.1). */
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

interface PendingSocialReply {
  requestId: `0x${string}`;
  payer: `0x${string}`;
  amount: bigint;
  refundNotBefore: bigint;
}

const SNAPZO_SOCIAL_REDEPLOY_BLOCK = BigInt(12_538_413);

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

  const socialNonceRead = useReadContract({
    chainId: mezoTestnet.id,
    address: SNAPZO_SOCIAL_ADDRESS,
    abi: [{ type: "function", name: "nonces", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] }] as const,
    functionName: "nonces",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && socialConfigured), staleTime: 10_000 },
  });
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

  const replyStakeAmount = replyStakeAmountRead.data;
  const replyStakeLabel =
    replyStakeAmount !== undefined
      ? formatUnitsMax2dp(replyStakeAmount, SNAP_DECIMALS)
      : "…";
  const unlockSnapLabel =
    unlockSnapWei !== undefined ? formatUnitsMax2dp(unlockSnapWei, SNAP_DECIMALS) : "…";

  const isLockedPost = Boolean(post.contentLocked);
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

  const { isLoading: isConfirming, isSuccess, isError } =
    useWaitForTransactionReceipt({
      hash: pendingHash,
      chainId: mezoTestnet.id,
      query: { enabled: Boolean(pendingHash) },
    });

  const mediaUnlocked = !isLockedPost || Boolean(post.unlockedByMe) || optimisticUnlocked;
  const isOwnPost = Boolean(
    address && post.tipRecipient.toLowerCase() === address.toLowerCase()
  );
  const hasTipped = dbHasTipped;
  const comments = dbReplies;
  const pendingDbReplies = useMemo(
    () => dbReplies.filter((r) => r.status === "pending"),
    [dbReplies]
  );

  const src = post.imageUrl;
  const showLockOverlay = isLockedPost && !mediaUnlocked;
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
        }
        toast(
          unlockSnapWei !== undefined
            ? `Unlocked · ${unlockMusdLabel} MUSD (~${formatUnitsMax2dp(unlockSnapWei, SNAP_DECIMALS)} SNAP)`
            : "Unlocked.",
        );
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
    unlockMusdLabel,
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
    const nonce = socialNonceRead.data;
    const likeTipAmount = likeTipAmountRead.data;
    if (
      !socialConfigured ||
      nonce === undefined ||
      likeTipAmount === undefined
    ) {
      toast("Social tip config unavailable. Retry in a moment.", "error");
      return;
    }
    if (socialSnapTokenAddress === undefined) {
      toast("Social token address unavailable. Retry in a moment.", "error");
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
          nonce,
          deadline,
        },
      });

      toast("Submitting through social relayer…");
      const relayed = await fetch("/api/snapzo/social/relay-tip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tipper: address,
          postId: String(socialPostId),
          creator: post.tipRecipient,
          nonce: String(nonce),
          deadline: String(deadline),
          signature,
        }),
      });
      const payload = (await relayed.json().catch(() => ({}))) as {
        hash?: `0x${string}`;
        error?: string;
      };
      if (!relayed.ok || !payload.hash) {
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
    socialNonceRead.data,
    likeTipAmountRead.data,
    socialTokenBalance,
    allowanceValue,
    refetchAllowance,
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
      const nonce = socialNonceRead.data;
      if (nonce === undefined) {
        toast("Creator nonce unavailable. Retry in a moment.", "error");
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
          nonce,
          deadline,
        },
      });
      toast("Submitting creator fulfill through social relayer…");
      const relayed = await fetch("/api/snapzo/social/relay-fulfill-reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          creator: address,
          requestId: selectedRequestId,
          commentId: String(commentId),
          nonce: String(nonce),
          deadline: String(deadline),
          signature,
        }),
      });
      const payload = (await relayed.json().catch(() => ({}))) as {
        hash?: `0x${string}`;
        error?: string;
      };
      if (!relayed.ok || !payload.hash) {
        throw new Error(payload.error || "Reply fulfill relay failed");
      }
      setPendingKind("replyFulfill");
      setPendingHash(payload.hash);
      toast("Confirming on Mezo…");
      return;
    }

    const nonce = socialNonceRead.data;
    const stake = replyStakeAmountRead.data;
    if (nonce === undefined || stake === undefined || stake <= BigInt(0)) {
      toast("Reply stake config unavailable. Retry in a moment.", "error");
      return;
    }
    try {
      if (socialTokenBalance < stake) {
        throw new Error(
          `Insufficient SNAP for reply stake. Need ${formatUnits(
            stake,
            SNAP_DECIMALS
          )} SNAP.`
        );
      }
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
            nonce,
          ]
        )
      ) as `0x${string}`;

      setPendingCommentText(text);
      setPendingRequestId(requestId);
      setPendingCommentId(null);
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
          nonce,
          deadline,
        },
      });
      toast("Submitting reply request through social relayer…");
      const relayed = await fetch("/api/snapzo/social/relay-reply-deposit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payer: address,
          postId: String(socialPostId),
          creator: post.tipRecipient,
          nonce: String(nonce),
          deadline: String(deadline),
          signature,
        }),
      });
      const payload = (await relayed.json().catch(() => ({}))) as {
        hash?: `0x${string}`;
        error?: string;
      };
      if (!relayed.ok || !payload.hash) {
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
    <article className="snapzo-card-primary mx-4 mb-5 transition-transform duration-300 ease-out hover:-translate-y-0.5">
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-indigo-400/35 ring-offset-1 ring-offset-[rgba(8,12,22,0.65)]">
          <Image
            src={post.avatarUrl ?? picsumAvatar(post.avatarSeed, 128)}
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
          className="snapzo-pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/[0.1] bg-black/20 text-zinc-500 hover:border-white/18 hover:bg-white/[0.06] hover:text-white active:scale-[0.96]"
          aria-label="Post menu"
        >
          <Ellipsis className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>
      </div>

      <div
        className="relative mx-3 aspect-[4/5] touch-manipulation overflow-hidden rounded-[22px] bg-zinc-900/80 ring-1 ring-white/[0.04]"
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
            className={`object-cover transition-[filter,transform] duration-500 ease-out ${
              showLockOverlay ? "scale-[1.04] blur-2xl" : "blur-0"
            }`}
            sizes="(max-width: 430px) 100vw, 382px"
            priority={post.id === "1"}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-xs text-zinc-500">
            Media unavailable
          </div>
        )}
        {showLockOverlay ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-black/70 via-black/38 to-black/22 px-6 text-center">
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
              className="snapzo-pressable inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-400/36 bg-gradient-to-br from-indigo-500/24 to-sky-500/16 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_18px_rgba(99,102,241,0.16)] hover:border-indigo-300/55 hover:from-indigo-500/34 disabled:opacity-50"
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
              className={`snapzo-pressable flex items-center gap-2 border-0 bg-transparent p-0 hover:opacity-90 active:opacity-75 disabled:pointer-events-none disabled:opacity-35 ${likedUi ? "text-red-500" : "text-white"}`}
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
              <span className="text-sm font-normal tabular-nums tracking-tight">
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
              {replyStakeLabel} <SnapInlineIcon decorative />
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

        {recentLikers.length > 0 ? (
          <div className="mt-2 flex items-center gap-2">
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
                    <h2
                      id={labelId}
                      className="text-base font-semibold tracking-tight text-white"
                    >
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
                    <ul className="space-y-0.5 pb-3">
                      {comments.map((c) => (
                        <li key={c.id} className="flex gap-3 py-3">
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

                <div className="shrink-0 border-t border-white/[0.08] bg-[#0b0f18] px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2">
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
                      className="max-h-28 min-h-[42px] flex-1 resize-none rounded-[22px] border border-white/10 bg-zinc-950/80 px-4 py-2.5 text-sm leading-snug text-white placeholder:text-zinc-500 outline-none transition focus:border-white/20 focus:ring-1 focus:ring-white/15 disabled:opacity-50"
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
