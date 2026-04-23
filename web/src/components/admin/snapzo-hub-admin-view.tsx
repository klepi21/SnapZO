"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ArrowLeft, Loader2, Shield } from "lucide-react";
import {
  type Address,
  UserRejectedRequestError,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
} from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWriteContract,
} from "wagmi";

import { SnapInlineIcon } from "@/components/icons/snap-inline-icon";
import { useSnapzoToast } from "@/components/providers/snapzo-toast-provider";
import { mezoTestnet } from "@/lib/chains/mezo-testnet";
import { mezoSmusdGaugeAbi } from "@/lib/constants/mezo-earn";
import {
  erc20BalanceAbi,
  erc20TransferAbi,
  MUSD_ADDRESS_MEZO_TESTNET,
  MUSD_DECIMALS,
} from "@/lib/constants/musd";
import { snapZoHubAdminAbi } from "@/lib/constants/snapzo-hub-admin-abi";
import { snapZoRewardsAbi } from "@/lib/constants/snapzo-rewards-abi";
import { snapZoSocialAdminAbi } from "@/lib/constants/snapzo-social-admin-abi";
import {
  isSnapZoHubConfigured,
  isSnapZoRewardsConfigured,
  isSnapZoSocialConfigured,
  SNAP_DECIMALS,
  SNAPZO_HUB_ADDRESS,
  SNAPZO_HUB_DEPLOY_BLOCK,
  SNAPZO_REWARDS_ADDRESS,
  SNAPZO_SOCIAL_ADDRESS,
} from "@/lib/constants/snapzo-hub";
import { SnapZoRewardsClaimPanel } from "@/components/momento/snapzo-rewards-claim-panel";
import { fetchHubRelayerRows } from "@/lib/snapzo/hub-relayers-from-chain";

const hub = SNAPZO_HUB_ADDRESS;
const social = SNAPZO_SOCIAL_ADDRESS;
const rewards = SNAPZO_REWARDS_ADDRESS;

/** Mezo MUSD vault shares (sMUSD) use 18 decimals. */
const SMUSD_DECIMALS = 18;

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

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
    return e.message.slice(0, 200);
  }
  return "Something went wrong.";
}

/** Display amount with trimmed fractional digits; hover `title` uses full precision. */
function fmtBalShort(v: bigint | undefined, maxFrac = 6, d = MUSD_DECIMALS): string {
  if (v === undefined) {
    return "…";
  }
  const s = formatUnits(v, d);
  const [intPart, frac = ""] = s.split(".");
  if (!frac) {
    return intPart;
  }
  const cut = frac.slice(0, maxFrac).replace(/0+$/, "");
  return cut ? `${intPart}.${cut}` : intPart;
}

function fmtBalTitle(v: bigint | undefined, d = MUSD_DECIMALS): string | undefined {
  if (v === undefined) {
    return undefined;
  }
  return formatUnits(v, d);
}

function parseCsvAddresses(raw: string): Address[] | undefined {
  const parts = raw
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter(Boolean);
  if (!parts.length) return undefined;
  const out: Address[] = [];
  for (const p of parts) {
    if (!isAddress(p)) return undefined;
    out.push(getAddress(p as Address));
  }
  return out;
}

function parseCsvBigInt(raw: string): bigint[] | undefined {
  const parts = raw
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter(Boolean);
  if (!parts.length) return undefined;
  const out: bigint[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return undefined;
    out.push(BigInt(p));
  }
  return out;
}

export function SnapZoHubAdminView() {
  const toast = useSnapzoToast();
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: mezoTestnet.id });
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  const hubOk = isSnapZoHubConfigured();
  const socialOk = isSnapZoSocialConfigured();
  const rewardsOk = isSnapZoRewardsConfigured();

  const relayersListQuery = useQuery({
    queryKey: ["snapzoHubRelayers", hub, String(SNAPZO_HUB_DEPLOY_BLOCK)] as const,
    enabled: Boolean(hubOk && publicClient),
    queryFn: async () => {
      if (!publicClient) {
        return [];
      }
      return fetchHubRelayerRows(publicClient, hub as Address, SNAPZO_HUB_DEPLOY_BLOCK);
    },
    staleTime: 20_000,
  });

  const [busy, setBusy] = useState(false);
  const [relayerIn, setRelayerIn] = useState("");
  const [relayerAllowed, setRelayerAllowed] = useState(true);
  const [feeBpsIn, setFeeBpsIn] = useState("");
  const [feeRecvIn, setFeeRecvIn] = useState("");
  const [recoverTo, setRecoverTo] = useState("");
  const [recoverAmt, setRecoverAmt] = useState("");
  const [sweepToken, setSweepToken] = useState("");
  const [sweepAmt, setSweepAmt] = useState("");
  const [intMusd, setIntMusd] = useState("");
  const [intVault, setIntVault] = useState("");
  const [intGauge, setIntGauge] = useState("");
  const [intRouter, setIntRouter] = useState("");
  const [intReward, setIntReward] = useState("");
  const [routesHex, setRoutesHex] = useState("");
  const [feePayoutTo, setFeePayoutTo] = useState("");
  const [likeTipIn, setLikeTipIn] = useState("");
  const [replyStakeIn, setReplyStakeIn] = useState("");
  const [socialRelayerIn, setSocialRelayerIn] = useState("");
  const [socialRelayerAllowed, setSocialRelayerAllowed] = useState(true);
  const [hubRewardContractIn, setHubRewardContractIn] = useState("");
  const [rewardsRelayerIn, setRewardsRelayerIn] = useState("");
  const [rewardsUsersIn, setRewardsUsersIn] = useState("");
  const [rewardsAmountsIn, setRewardsAmountsIn] = useState("");
  const [rewardsBpsIn, setRewardsBpsIn] = useState("");
  const [rewardsPoolIn, setRewardsPoolIn] = useState("");
  const [rewardsReset, setRewardsReset] = useState(true);
  const [withdrawUnclaimedIn, setWithdrawUnclaimedIn] = useState("");
  const [rewardsPreviewUserIn, setRewardsPreviewUserIn] = useState("");
  const [pauseOpen, setPauseOpen] = useState(false);
  const [relayersOpen, setRelayersOpen] = useState(false);
  const [feeConfigOpen, setFeeConfigOpen] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);

  const wrongChain = isConnected && chainId !== mezoTestnet.id;

  const hubReads = useReadContracts({
    contracts: [
      { chainId: mezoTestnet.id, address: hub, abi: snapZoHubAdminAbi, functionName: "owner" },
      { chainId: mezoTestnet.id, address: hub, abi: snapZoHubAdminAbi, functionName: "paused" },
      { chainId: mezoTestnet.id, address: hub, abi: snapZoHubAdminAbi, functionName: "feeBps" },
      { chainId: mezoTestnet.id, address: hub, abi: snapZoHubAdminAbi, functionName: "feeReceiver" },
      { chainId: mezoTestnet.id, address: hub, abi: snapZoHubAdminAbi, functionName: "musd" },
      { chainId: mezoTestnet.id, address: hub, abi: snapZoHubAdminAbi, functionName: "vault" },
      { chainId: mezoTestnet.id, address: hub, abi: snapZoHubAdminAbi, functionName: "gauge" },
      { chainId: mezoTestnet.id, address: hub, abi: snapZoHubAdminAbi, functionName: "router" },
      { chainId: mezoTestnet.id, address: hub, abi: snapZoHubAdminAbi, functionName: "rewardToken" },
      { chainId: mezoTestnet.id, address: hub, abi: snapZoHubAdminAbi, functionName: "rewardContract" },
      { chainId: mezoTestnet.id, address: hub, abi: snapZoHubAdminAbi, functionName: "snapToken" },
    ],
    query: {
      enabled: hubOk,
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const socialReads = useReadContracts({
    contracts: [
      { chainId: mezoTestnet.id, address: social, abi: snapZoSocialAdminAbi, functionName: "owner" },
      { chainId: mezoTestnet.id, address: social, abi: snapZoSocialAdminAbi, functionName: "paused" },
      { chainId: mezoTestnet.id, address: social, abi: snapZoSocialAdminAbi, functionName: "likeTipAmount" },
      { chainId: mezoTestnet.id, address: social, abi: snapZoSocialAdminAbi, functionName: "replyStakeAmount" },
      { chainId: mezoTestnet.id, address: social, abi: snapZoSocialAdminAbi, functionName: "snapToken" },
      { chainId: mezoTestnet.id, address: social, abi: snapZoSocialAdminAbi, functionName: "REPLY_WINDOW" },
    ],
    query: {
      enabled: socialOk,
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const rewardsReads = useReadContracts({
    contracts: [
      { chainId: mezoTestnet.id, address: rewards, abi: snapZoRewardsAbi, functionName: "owner" },
      { chainId: mezoTestnet.id, address: rewards, abi: snapZoRewardsAbi, functionName: "paused" },
      { chainId: mezoTestnet.id, address: rewards, abi: snapZoRewardsAbi, functionName: "relayer" },
      { chainId: mezoTestnet.id, address: rewards, abi: snapZoRewardsAbi, functionName: "rewardToken" },
      {
        chainId: mezoTestnet.id,
        address: rewards,
        abi: snapZoRewardsAbi,
        functionName: "lastUpdateTimestamp",
      },
      { chainId: mezoTestnet.id, address: rewards, abi: snapZoRewardsAbi, functionName: "MAX_BPS" },
    ],
    query: {
      enabled: rewardsOk,
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const owner = hubReads.data?.[0]?.status === "success" ? hubReads.data[0].result : undefined;
  const paused = hubReads.data?.[1]?.status === "success" ? hubReads.data[1].result : undefined;
  const feeBps = hubReads.data?.[2]?.status === "success" ? hubReads.data[2].result : undefined;
  const feeReceiver = hubReads.data?.[3]?.status === "success" ? hubReads.data[3].result : undefined;
  const vaultAddr =
    hubReads.data?.[5]?.status === "success" ? hubReads.data[5].result : undefined;
  const gaugeAddr =
    hubReads.data?.[6]?.status === "success" ? hubReads.data[6].result : undefined;
  const rewardTokenAddr =
    hubReads.data?.[8]?.status === "success" ? hubReads.data[8].result : undefined;
  const rewardContractAddr =
    hubReads.data?.[9]?.status === "success" ? hubReads.data[9].result : undefined;

  const socialOwner =
    socialReads.data?.[0]?.status === "success" ? socialReads.data[0].result : undefined;
  const socialPaused =
    socialReads.data?.[1]?.status === "success" ? socialReads.data[1].result : undefined;
  const likeTipAmount =
    socialReads.data?.[2]?.status === "success" ? socialReads.data[2].result : undefined;
  const replyStakeAmount =
    socialReads.data?.[3]?.status === "success" ? socialReads.data[3].result : undefined;
  const socialSnapToken =
    socialReads.data?.[4]?.status === "success" ? socialReads.data[4].result : undefined;
  const replyWindowSec =
    socialReads.data?.[5]?.status === "success" ? socialReads.data[5].result : undefined;

  const rewardsOwner =
    rewardsReads.data?.[0]?.status === "success" ? rewardsReads.data[0].result : undefined;
  const rewardsPaused =
    rewardsReads.data?.[1]?.status === "success" ? rewardsReads.data[1].result : undefined;
  const rewardsRelayer =
    rewardsReads.data?.[2]?.status === "success" ? rewardsReads.data[2].result : undefined;
  const rewardsTokenAddr =
    rewardsReads.data?.[3]?.status === "success" ? rewardsReads.data[3].result : undefined;
  const rewardsLastUpdateTs =
    rewardsReads.data?.[4]?.status === "success" ? rewardsReads.data[4].result : undefined;
  const rewardsMaxBps =
    rewardsReads.data?.[5]?.status === "success" ? rewardsReads.data[5].result : undefined;
  const rewardsIsCreatorsContract = rewardsMaxBps === BigInt(10_000);
  const rewardsPreviewClaimable = useReadContract({
    chainId: mezoTestnet.id,
    address: rewards,
    abi: snapZoRewardsAbi,
    functionName: "claimable",
    args: isAddress(rewardsPreviewUserIn.trim()) ? [getAddress(rewardsPreviewUserIn.trim() as Address)] : undefined,
    query: {
      enabled: rewardsOk && isAddress(rewardsPreviewUserIn.trim()),
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const smusdShareReads = useReadContracts({
    contracts: [
      {
        chainId: mezoTestnet.id,
        address: (vaultAddr ?? ZERO_ADDR) as `0x${string}`,
        abi: erc20BalanceAbi,
        functionName: "balanceOf",
        args: hubOk && vaultAddr ? [hub] : undefined,
      },
      {
        chainId: mezoTestnet.id,
        address: (gaugeAddr ?? ZERO_ADDR) as `0x${string}`,
        abi: erc20BalanceAbi,
        functionName: "balanceOf",
        args: hubOk && gaugeAddr ? [hub] : undefined,
      },
    ],
    query: {
      enabled: Boolean(hubOk && vaultAddr && gaugeAddr),
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const smusdIdleWei =
    smusdShareReads.data?.[0]?.status === "success" ? smusdShareReads.data[0].result : undefined;
  const smusdStakedWei =
    smusdShareReads.data?.[1]?.status === "success" ? smusdShareReads.data[1].result : undefined;
  const smusdTotalWei =
    smusdIdleWei !== undefined && smusdStakedWei !== undefined
      ? smusdIdleWei + smusdStakedWei
      : undefined;

  const isHubOwner =
    Boolean(address && owner) &&
    getAddress(address as `0x${string}`) === getAddress(owner as `0x${string}`);

  const isSocialOwner =
    Boolean(address && socialOwner) &&
    getAddress(address as `0x${string}`) === getAddress(socialOwner as `0x${string}`);

  const isRewardsOwner =
    Boolean(address && rewardsOwner) &&
    getAddress(address as `0x${string}`) === getAddress(rewardsOwner as `0x${string}`);

  const secondaryReads = useReadContracts({
    contracts: [
      {
        chainId: mezoTestnet.id,
        address: (gaugeAddr ??
          "0x0000000000000000000000000000000000000000") as `0x${string}`,
        abi: mezoSmusdGaugeAbi,
        functionName: "earned",
        args: hubOk && gaugeAddr ? [hub] : undefined,
      },
      {
        chainId: mezoTestnet.id,
        address: (rewardTokenAddr ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
        abi: erc20BalanceAbi,
        functionName: "balanceOf",
        args: hubOk && rewardTokenAddr ? [hub] : undefined,
      },
      {
        chainId: mezoTestnet.id,
        address: (rewardTokenAddr ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
        abi: erc20BalanceAbi,
        functionName: "balanceOf",
        args: hubOk && rewardTokenAddr && feeReceiver ? [feeReceiver] : undefined,
      },
      {
        chainId: mezoTestnet.id,
        address: MUSD_ADDRESS_MEZO_TESTNET,
        abi: erc20BalanceAbi,
        functionName: "balanceOf",
        args: hubOk ? [hub] : undefined,
      },
      {
        chainId: mezoTestnet.id,
        address: (rewardsTokenAddr ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
        abi: erc20BalanceAbi,
        functionName: "balanceOf",
        args: rewardsOk && rewardsTokenAddr ? [rewards] : undefined,
      },
    ],
    query: {
      enabled: Boolean(
        (hubOk && gaugeAddr && rewardTokenAddr && feeReceiver) || (rewardsOk && rewardsTokenAddr),
      ),
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const earnedGauge = secondaryReads.data?.[0]?.status === "success" ? secondaryReads.data[0].result : undefined;
  const rewardOnHub = secondaryReads.data?.[1]?.status === "success" ? secondaryReads.data[1].result : undefined;
  const rewardOnFeeReceiver =
    secondaryReads.data?.[2]?.status === "success" ? secondaryReads.data[2].result : undefined;
  const musdOnHub = secondaryReads.data?.[3]?.status === "success" ? secondaryReads.data[3].result : undefined;
  const rewardOnRewardsContract =
    secondaryReads.data?.[4]?.status === "success" ? secondaryReads.data[4].result : undefined;

  const refetchAll = useCallback(async () => {
    await hubReads.refetch();
    await socialReads.refetch();
    await rewardsReads.refetch();
    await smusdShareReads.refetch();
    await secondaryReads.refetch();
    await queryClient.invalidateQueries({ queryKey: ["snapzoHubRelayers"] });
  }, [
    hubReads,
    queryClient,
    rewardsReads,
    secondaryReads,
    smusdShareReads,
    socialReads,
  ]);

  const runHubWrite = useCallback(
    async (label: string, fn: () => Promise<`0x${string}`>) => {
      if (!isConnected) {
        openConnectModal?.();
        return;
      }
      if (wrongChain) {
        switchChain?.({ chainId: mezoTestnet.id });
        return;
      }
      if (!isHubOwner) {
        toast("Connect the hub owner wallet.", "error");
        return;
      }
      setBusy(true);
      try {
        const h = await fn();
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: h });
        }
        toast(label);
        await refetchAll();
      } catch (e) {
        toast(formatTxError(e), "error");
      } finally {
        setBusy(false);
      }
    },
    [
      isConnected,
      isHubOwner,
      openConnectModal,
      publicClient,
      refetchAll,
      switchChain,
      toast,
      wrongChain,
    ],
  );

  const runSocialWrite = useCallback(
    async (label: string, fn: () => Promise<`0x${string}`>) => {
      if (!isConnected) {
        openConnectModal?.();
        return;
      }
      if (wrongChain) {
        switchChain?.({ chainId: mezoTestnet.id });
        return;
      }
      if (!isSocialOwner) {
        toast("Connect the SnapZoSocial owner wallet.", "error");
        return;
      }
      setBusy(true);
      try {
        const h = await fn();
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: h });
        }
        toast(label);
        await refetchAll();
      } catch (e) {
        toast(formatTxError(e), "error");
      } finally {
        setBusy(false);
      }
    },
    [
      isConnected,
      isSocialOwner,
      openConnectModal,
      publicClient,
      refetchAll,
      switchChain,
      toast,
      wrongChain,
    ],
  );

  const runRewardsWrite = useCallback(
    async (label: string, fn: () => Promise<`0x${string}`>) => {
      if (!isConnected) {
        openConnectModal?.();
        return;
      }
      if (wrongChain) {
        switchChain?.({ chainId: mezoTestnet.id });
        return;
      }
      if (!isRewardsOwner) {
        toast("Connect the SnapZoCreators owner wallet.", "error");
        return;
      }
      setBusy(true);
      try {
        const h = await fn();
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: h });
        }
        toast(label);
        await refetchAll();
      } catch (e) {
        toast(formatTxError(e), "error");
      } finally {
        setBusy(false);
      }
    },
    [
      isConnected,
      isRewardsOwner,
      openConnectModal,
      publicClient,
      refetchAll,
      switchChain,
      toast,
      wrongChain,
    ],
  );

  const onHarvest = () =>
    void runHubWrite("Harvest complete", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "harvest",
      }),
    );

  const onSyncGaugeRewards = () =>
    void runHubWrite("Gauge rewards synced", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "syncGaugeRewards",
      }),
    );

  const onRestake = () =>
    void runHubWrite("Restake complete", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "restake",
      }),
    );

  const onPause = () =>
    void runHubWrite("Paused", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "pause",
      }),
    );

  const onUnpause = () =>
    void runHubWrite("Unpaused", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "unpause",
      }),
    );

  const onSetRelayer = () => {
    if (!isAddress(relayerIn.trim())) {
      toast("Invalid relayer address.", "error");
      return;
    }
    void runHubWrite("Relayer updated", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "setRelayer",
        args: [getAddress(relayerIn.trim() as `0x${string}`), relayerAllowed],
      }),
    );
  };

  const onSetFee = () => {
    const b = Number(feeBpsIn.trim());
    if (!Number.isFinite(b) || b < 0 || b > 2000) {
      toast("feeBps must be 0–2000.", "error");
      return;
    }
    const recv =
      feeRecvIn.trim() === "" || !isAddress(feeRecvIn.trim())
        ? "0x0000000000000000000000000000000000000000"
        : getAddress(feeRecvIn.trim() as `0x${string}`);
    void runHubWrite("Fee config updated", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "setFee",
        args: [b, recv],
      }),
    );
  };

  const onSetHubRewardContract = () => {
    if (!isAddress(hubRewardContractIn.trim())) {
      toast("Invalid rewards contract address.", "error");
      return;
    }
    void runHubWrite("Hub reward contract updated", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "setRewardContract",
        args: [getAddress(hubRewardContractIn.trim() as `0x${string}`)],
      }),
    );
  };

  const onRecoverReward = () => {
    if (!paused) {
      toast("Pause the hub before recoverRewardToken (protects indexed MEZO).", "error");
      return;
    }
    if (!isAddress(recoverTo.trim())) {
      toast("Invalid recipient.", "error");
      return;
    }
    const t = recoverAmt.trim().replace(",", ".");
    if (!t) {
      toast("Enter amount (reward token).", "error");
      return;
    }
    let amt: bigint;
    try {
      amt = parseUnits(t, MUSD_DECIMALS);
    } catch {
      toast("Invalid amount.", "error");
      return;
    }
    void runHubWrite("Reward token recovered", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "recoverRewardToken",
        args: [getAddress(recoverTo.trim() as `0x${string}`), amt],
      }),
    );
  };

  const onRecoverAllToSelf = () => {
    if (!paused) {
      toast("Pause the hub before recovering reward tokens.", "error");
      return;
    }
    if (!address) {
      return;
    }
    void runHubWrite("Reward token sent to your wallet", async () => {
      const r = await secondaryReads.refetch();
      const bal =
        r.data?.[1]?.status === "success" ? (r.data[1].result as bigint) : undefined;
      if (bal === undefined || bal === BigInt(0)) {
        throw new Error("No reward token on hub after refresh.");
      }
      return writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "recoverRewardToken",
        args: [getAddress(address), bal],
      });
    });
  };

  const onSweep = () => {
    if (!paused) {
      toast("Pause the hub before sweep.", "error");
      return;
    }
    if (!isAddress(sweepToken.trim())) {
      toast("Invalid token address.", "error");
      return;
    }
    let amt: bigint;
    try {
      amt = parseUnits(sweepAmt.trim().replace(",", "."), MUSD_DECIMALS);
    } catch {
      toast("Invalid sweep amount.", "error");
      return;
    }
    void runHubWrite("Swept", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "sweep",
        args: [getAddress(sweepToken.trim() as `0x${string}`), amt],
      }),
    );
  };

  const onSetIntegrations = () => {
    if (!paused) {
      toast("Pause before changing integrations.", "error");
      return;
    }
    if (
      !isAddress(intMusd.trim()) ||
      !isAddress(intVault.trim()) ||
      !isAddress(intGauge.trim()) ||
      !isAddress(intRouter.trim()) ||
      !isAddress(intReward.trim())
    ) {
      toast("All five addresses must be valid.", "error");
      return;
    }
    void runHubWrite("Integrations updated", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "setIntegrations",
        args: [
          getAddress(intMusd.trim() as `0x${string}`),
          getAddress(intVault.trim() as `0x${string}`),
          getAddress(intGauge.trim() as `0x${string}`),
          getAddress(intRouter.trim() as `0x${string}`),
          getAddress(intReward.trim() as `0x${string}`),
        ],
      }),
    );
  };

  const onSetRoutes = () => {
    if (!paused) {
      toast("Pause before updating restake routes.", "error");
      return;
    }
    const h = routesHex.trim();
    if (!h.startsWith("0x")) {
      toast("Routes must be 0x-prefixed ABI-encoded bytes.", "error");
      return;
    }
    void runHubWrite("Restake routes updated", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "setRestakeRoutes",
        args: [h as `0x${string}`],
      }),
    );
  };

  const onSocialSetLikeTip = () => {
    const t = likeTipIn.trim().replace(",", ".");
    if (!t) {
      toast("Enter SNAP amount for one like tip.", "error");
      return;
    }
    let amt: bigint;
    try {
      amt = parseUnits(t, SNAP_DECIMALS);
    } catch {
      toast("Invalid amount.", "error");
      return;
    }
    void runSocialWrite("Like tip amount updated", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: social,
        abi: snapZoSocialAdminAbi,
        functionName: "setLikeTipAmount",
        args: [amt],
      }),
    );
  };

  const onSocialSetReplyStake = () => {
    const t = replyStakeIn.trim().replace(",", ".");
    if (!t) {
      toast("Enter SNAP amount for paid-reply stake.", "error");
      return;
    }
    let amt: bigint;
    try {
      amt = parseUnits(t, SNAP_DECIMALS);
    } catch {
      toast("Invalid amount.", "error");
      return;
    }
    void runSocialWrite("Reply stake amount updated", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: social,
        abi: snapZoSocialAdminAbi,
        functionName: "setReplyStakeAmount",
        args: [amt],
      }),
    );
  };

  const onSocialPause = () =>
    void runSocialWrite("SnapZoSocial paused", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: social,
        abi: snapZoSocialAdminAbi,
        functionName: "pause",
      }),
    );

  const onSocialUnpause = () =>
    void runSocialWrite("SnapZoSocial unpaused", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: social,
        abi: snapZoSocialAdminAbi,
        functionName: "unpause",
      }),
    );

  const onSocialSetRelayer = () => {
    if (!isAddress(socialRelayerIn.trim())) {
      toast("Invalid relayer address.", "error");
      return;
    }
    void runSocialWrite("Social relayer updated", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: social,
        abi: snapZoSocialAdminAbi,
        functionName: "setRelayer",
        args: [getAddress(socialRelayerIn.trim() as `0x${string}`), socialRelayerAllowed],
      }),
    );
  };

  const onRewardsSetRelayer = () => {
    if (!isAddress(rewardsRelayerIn.trim())) {
      toast("Invalid rewards relayer address.", "error");
      return;
    }
    void runRewardsWrite("Rewards relayer updated", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: rewards,
        abi: snapZoRewardsAbi,
        functionName: "setRelayer",
        args: [getAddress(rewardsRelayerIn.trim() as `0x${string}`)],
      }),
    );
  };

  const onRewardsSetAllocations = () => {
    if (!rewardsIsCreatorsContract) {
      toast("This rewards address is legacy Merkle contract. Set SnapZoCreators address first.", "error");
      return;
    }
    const users = parseCsvAddresses(rewardsUsersIn);
    if (!users?.length) {
      toast("Users must be valid addresses (comma/newline separated).", "error");
      return;
    }
    const amountsRaw = rewardsAmountsIn
      .split(/[\s,]+/)
      .map((v) => v.trim())
      .filter(Boolean);
    if (amountsRaw.length !== users.length) {
      toast("Users and amounts must have same count.", "error");
      return;
    }
    const amounts: bigint[] = [];
    for (const value of amountsRaw) {
      try {
        amounts.push(parseUnits(value.replace(",", "."), MUSD_DECIMALS));
      } catch {
        toast("Invalid amount in list.", "error");
        return;
      }
    }
    void runRewardsWrite("Creators allocations updated", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: rewards,
        abi: snapZoRewardsAbi,
        functionName: "setAllocations",
        args: [users, amounts, rewardsReset],
      }),
    );
  };

  const onRewardsSetAllocationsByBps = () => {
    if (!rewardsIsCreatorsContract) {
      toast("This rewards address is legacy Merkle contract. Set SnapZoCreators address first.", "error");
      return;
    }
    const users = parseCsvAddresses(rewardsUsersIn);
    if (!users?.length) {
      toast("Users must be valid addresses (comma/newline separated).", "error");
      return;
    }
    const bps = parseCsvBigInt(rewardsBpsIn);
    if (!bps?.length || bps.length !== users.length) {
      toast("Users and bps must have same count.", "error");
      return;
    }
    const total = bps.reduce((acc, v) => acc + v, BigInt(0));
    if (total !== BigInt(10_000)) {
      toast("BPS must sum to 10000.", "error");
      return;
    }
    let poolAmount: bigint;
    try {
      poolAmount = parseUnits(rewardsPoolIn.trim().replace(",", "."), MUSD_DECIMALS);
    } catch {
      toast("Invalid pool amount.", "error");
      return;
    }
    void runRewardsWrite("Creators allocations by BPS updated", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: rewards,
        abi: snapZoRewardsAbi,
        functionName: "setAllocationsByBps",
        args: [users, bps, poolAmount, rewardsReset],
      }),
    );
  };

  const onRewardsPause = () =>
    void runRewardsWrite("SnapZoRewards paused", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: rewards,
        abi: snapZoRewardsAbi,
        functionName: "pause",
      }),
    );

  const onRewardsUnpause = () =>
    void runRewardsWrite("SnapZoRewards unpaused", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: rewards,
        abi: snapZoRewardsAbi,
        functionName: "unpause",
      }),
    );

  const onRewardsWithdrawUnclaimed = () => {
    const t = withdrawUnclaimedIn.trim().replace(",", ".");
    if (!t) {
      toast("Enter amount for withdrawUnclaimed.", "error");
      return;
    }
    let amt: bigint;
    try {
      amt = parseUnits(t, MUSD_DECIMALS);
    } catch {
      toast("Invalid amount.", "error");
      return;
    }
    void runRewardsWrite("Unclaimed rewards withdrawn", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: rewards,
        abi: snapZoRewardsAbi,
        functionName: "withdrawUnclaimed",
        args: [amt],
      }),
    );
  };

  const onTreasuryTransferOut = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (wrongChain) {
      switchChain?.({ chainId: mezoTestnet.id });
      return;
    }
    if (!address || !feeReceiver || !rewardTokenAddr || !owner) {
      return;
    }
    if (getAddress(address) !== getAddress(feeReceiver)) {
      toast("Connect the fee recipient wallet to move that balance.", "error");
      return;
    }
    const destRaw = feePayoutTo.trim();
    if (destRaw && !isAddress(destRaw)) {
      toast("Invalid payout recipient address.", "error");
      return;
    }
    const dest = destRaw
      ? getAddress(destRaw as `0x${string}`)
      : getAddress(owner as `0x${string}`);
    if (getAddress(dest) === getAddress(feeReceiver)) {
      toast("Choose a recipient other than the fee wallet (self-transfer does not move tokens).", "error");
      return;
    }
    setBusy(true);
    try {
      const r = await secondaryReads.refetch();
      const bal =
        r.data?.[2]?.status === "success" ? (r.data[2].result as bigint) : undefined;
      if (bal === undefined || bal === BigInt(0)) {
        toast("No reward token on fee recipient (after refresh).", "error");
        return;
      }
      const h = await writeContractAsync({
        chainId: mezoTestnet.id,
        address: rewardTokenAddr,
        abi: erc20TransferAbi,
        functionName: "transfer",
        args: [dest, bal],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: h });
      }
      toast("Sent fee-recipient reward balance to destination.");
      await refetchAll();
    } catch (e) {
      toast(formatTxError(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const canAct = isConnected && !wrongChain && !busy && !isWritePending && isHubOwner;
  const canActSocial =
    isConnected && !wrongChain && !busy && !isWritePending && isSocialOwner;
  const canActRewards =
    isConnected && !wrongChain && !busy && !isWritePending && isRewardsOwner;
  const explorerBase = mezoTestnet.blockExplorers.default.url;
  const treasuryCan =
    isConnected &&
    !wrongChain &&
    !busy &&
    !isWritePending &&
    Boolean(address && feeReceiver && rewardTokenAddr && owner) &&
    getAddress(address as `0x${string}`) === getAddress(feeReceiver as `0x${string}`);

  const card =
    "rounded-xl border border-white/[0.12] bg-[#101831]/88 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.28)] backdrop-blur-sm";
  const label = "mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400";
  const input =
    "w-full rounded-xl border border-white/14 bg-[#090d1b]/90 px-3 py-2.5 font-mono text-sm text-white outline-none placeholder:text-zinc-600 focus:border-fuchsia-300/40";
  const btnPrimary =
    "inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-[#ff2d90] to-[#7c3aed] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40";
  const btnDanger =
    "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-red-500/40 bg-red-500/15 px-4 text-sm font-semibold text-red-200 transition hover:bg-red-500/25 disabled:opacity-40";
  const btnMuted =
    "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/20 bg-white/[0.08] px-4 text-sm font-semibold text-zinc-100 transition hover:border-fuchsia-300/35 hover:bg-fuchsia-500/10 disabled:opacity-40";
  const miniAction =
    "rounded-md border border-white/15 px-2 py-1 text-[10px] font-semibold text-zinc-300 transition hover:bg-white/10";

  const copyAddress = useCallback(
    async (value: string | undefined, labelText: string) => {
      if (!value || !isAddress(value)) {
        toast(`No valid ${labelText} address to copy.`, "error");
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        toast(`${labelText} copied.`);
      } catch {
        toast("Clipboard write failed.", "error");
      }
    },
    [toast],
  );

  if (!hubOk && !socialOk && !rewardsOk) {
    return (
      <main className="px-4 pb-32 pt-5">
        <p className="text-sm text-zinc-400">
          SnapZo hub, social, and rewards contracts are not configured (set env addresses).
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-32 pt-5 xl:px-6">
      <div className="mb-5 flex items-start gap-3">
        <Link
          href="/earn"
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] text-white transition hover:border-fuchsia-300/35 hover:bg-fuchsia-500/10"
          aria-label="Back to earn"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-400" aria-hidden />
            <h1 className="text-xl font-semibold text-white">SnapZo admin</h1>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Owner-only controls on the hub and SnapZoSocial proxies. All txs use your wallet (gas in
            test BTC).
          </p>
          <Link
            href="/admin/snapzo/analytics"
            className="mt-2 inline-flex items-center rounded-lg border border-fuchsia-300/35 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
          >
            Open analytics admin view
          </Link>
        </div>
      </div>

      {wrongChain ? (
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100">
          Switch to Mezo testnet.
          <button
            type="button"
            className="ml-3 rounded-lg bg-amber-400 px-2 py-1 text-xs font-semibold text-zinc-950"
            onClick={() => switchChain?.({ chainId: mezoTestnet.id })}
          >
            Switch
          </button>
        </div>
      ) : null}

      {!isConnected ? (
        <p className="mb-4 text-sm text-zinc-400">Connect your wallet to use admin actions.</p>
      ) : null}

      {isConnected && hubOk && owner && !isHubOwner ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
          Connected wallet is not the hub owner ({String(owner).slice(0, 6)}…). Hub actions are
          disabled.
        </div>
      ) : null}

      {isConnected && socialOk && socialOwner && !isSocialOwner ? (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100">
          Connected wallet is not the SnapZoSocial owner ({String(socialOwner).slice(0, 6)}…). Social
          admin actions are disabled.
        </div>
      ) : null}

      {isConnected && rewardsOk && rewardsOwner && !isRewardsOwner ? (
        <div className="mb-4 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-sm text-sky-100">
          Connected wallet is not the SnapZoCreators owner ({String(rewardsOwner).slice(0, 6)}…).
          Rewards admin actions are disabled.
        </div>
      ) : null}

      <div className="space-y-5">
        {hubOk ? (
          <section className={`${card} border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.08] to-zinc-900/55`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-white">Hub control center</h2>
              <div className="flex items-center gap-2 text-[11px] text-zinc-300">
                <span className="rounded-md border border-white/15 px-2 py-1 font-mono">
                  {hub}
                </span>
              </div>
            </div>
            <div className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2">
                <p className="text-zinc-500">Hub paused</p>
                <p className="font-semibold text-zinc-100">{paused === undefined ? "…" : paused ? "Yes" : "No"}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2">
                <p className="text-zinc-500">Fee config</p>
                <p className="font-mono text-zinc-100">
                  {feeBps === undefined ? "…" : `${String(feeBps)} bps`}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2">
                <p className="text-zinc-500">Gauge MEZO pending</p>
                <p className="font-mono text-zinc-100" title={fmtBalTitle(earnedGauge)}>
                  {fmtBalShort(earnedGauge)}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2">
                <p className="text-zinc-500">Hub reward contract</p>
                <p className="truncate font-mono text-zinc-100">
                  {rewardContractAddr ?? "…"}
                </p>
              </div>
            </div>
            <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2">
                <p className="text-zinc-500">Fee receiver</p>
                <p className="truncate font-mono text-zinc-100">{feeReceiver ?? "…"}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2">
                <p className="text-zinc-500">SNAP token (hub state)</p>
                <p className="truncate font-mono text-zinc-100">
                  {hubReads.data?.[10]?.status === "success" ? String(hubReads.data[10].result) : "…"}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2">
                <p className="text-zinc-500">sMUSD on hub</p>
                <p className="font-mono text-zinc-100" title={fmtBalTitle(smusdTotalWei, SMUSD_DECIMALS)}>
                  {fmtBalShort(smusdTotalWei, 6, SMUSD_DECIMALS)}
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={miniAction} onClick={() => void copyAddress(hub, "Hub")}>
                Copy hub
              </button>
              <button
                type="button"
                className={miniAction}
                onClick={() => void copyAddress(rewardContractAddr, "Hub reward contract")}
              >
                Copy rewardContract
              </button>
              <a className={miniAction} href={`${explorerBase}/address/${hub}`} target="_blank" rel="noreferrer">
                Hub explorer
              </a>
              <button type="button" className={miniAction} onClick={() => void refetchAll()}>
                Refresh all
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/25 p-3">
              <h3 className="mb-2 text-sm font-semibold text-white">Rewards &amp; treasury</h3>
              <dl className="mb-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
                  <dt className="text-zinc-500">Gauge pending</dt>
                  <dd className="font-mono text-zinc-100" title={fmtBalTitle(earnedGauge)}>
                    {fmtBalShort(earnedGauge)}
                  </dd>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
                  <dt className="text-zinc-500">Reward token on hub</dt>
                  <dd className="font-mono text-zinc-100" title={fmtBalTitle(rewardOnHub)}>
                    {fmtBalShort(rewardOnHub)}
                  </dd>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
                  <dt className="text-zinc-500">Reward token on fee wallet</dt>
                  <dd className="font-mono text-zinc-100" title={fmtBalTitle(rewardOnFeeReceiver)}>
                    {fmtBalShort(rewardOnFeeReceiver)}
                  </dd>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
                  <dt className="text-zinc-500">MUSD idle on hub</dt>
                  <dd className="font-mono text-zinc-100" title={fmtBalTitle(musdOnHub)}>
                    {fmtBalShort(musdOnHub)}
                  </dd>
                </div>
              </dl>
              <div className="mb-3 flex flex-wrap gap-2">
                <button type="button" disabled={!canAct} className={btnPrimary} onClick={onHarvest}>
                  {(busy || isWritePending) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Harvest
                </button>
                <button type="button" disabled={!canAct} className={btnPrimary} onClick={onSyncGaugeRewards}>
                  Sync gauge
                </button>
                <button type="button" disabled={!canAct} className={btnMuted} onClick={onRestake}>
                  Restake
                </button>
                <button type="button" disabled={!canAct} className={btnMuted} onClick={onRecoverAllToSelf}>
                  Recover hub rewards → me
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-white/[0.06] bg-black/25 p-2.5">
                  <p className={label}>Fee wallet payout</p>
                  <input
                    className={`${input} mb-2`}
                    placeholder="Optional recipient 0x… (defaults to hub owner)"
                    value={feePayoutTo}
                    onChange={(e) => setFeePayoutTo(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={!treasuryCan || !rewardOnFeeReceiver || rewardOnFeeReceiver === BigInt(0)}
                    className={btnMuted}
                    onClick={() => void onTreasuryTransferOut()}
                  >
                    Send all fee rewards
                  </button>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-black/25 p-2.5">
                  <p className={label}>Custom recover</p>
                  <input
                    className={`${input} mb-2`}
                    placeholder="Recipient 0x…"
                    value={recoverTo}
                    onChange={(e) => setRecoverTo(e.target.value)}
                  />
                  <input
                    className={`${input} mb-2`}
                    placeholder="Amount (reward token, 18 dp)"
                    value={recoverAmt}
                    onChange={(e) => setRecoverAmt(e.target.value)}
                  />
                  <button
                    type="button"
                    className={`${btnMuted} w-full`}
                    disabled={!canAct}
                    onClick={() => void onRecoverReward()}
                  >
                    recoverRewardToken
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-3">
        {socialOk ? (
          <section className={card}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">SnapZoSocial</h2>
              <button
                type="button"
                className="rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:bg-white/10"
                onClick={() => void socialReads.refetch()}
              >
                Refresh
              </button>
            </div>
            <p className="mb-2 text-[10px] text-zinc-500">
              Social contract: <span className="font-mono">{social}</span>
            </p>
            <dl className="mb-4 grid gap-2 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Paused</dt>
                <dd className="font-medium text-zinc-200">
                  {socialPaused === undefined ? "…" : socialPaused ? "Yes" : "No"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="flex items-center gap-0.5 text-zinc-500">
                  <SnapInlineIcon decorative />
                  {"Like tip (per tip)"}
                </dt>
                <dd
                  className="font-mono text-zinc-200"
                  title={fmtBalTitle(likeTipAmount, SNAP_DECIMALS)}
                >
                  {fmtBalShort(likeTipAmount, 6, SNAP_DECIMALS)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="flex items-center gap-0.5 text-zinc-500">
                  <SnapInlineIcon decorative />
                  {"Reply stake (escrow)"}
                </dt>
                <dd
                  className="font-mono text-zinc-200"
                  title={fmtBalTitle(replyStakeAmount, SNAP_DECIMALS)}
                >
                  {fmtBalShort(replyStakeAmount, 6, SNAP_DECIMALS)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Reply window</dt>
                <dd className="font-mono text-zinc-200">
                  {replyWindowSec === undefined
                    ? "…"
                    : `${String(replyWindowSec)} sec (${Number(replyWindowSec) / 3600} h)`}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-zinc-500">SNAP token</dt>
                <dd className="break-all font-mono text-[10px] text-zinc-300">
                  {socialSnapToken ?? "…"}
                </dd>
              </div>
            </dl>
            <p className={`${label} mb-1`}>Set like tip (SNAP, 18 dp)</p>
            <input
              className={`${input} mb-2`}
              inputMode="decimal"
              placeholder="e.g. 1"
              value={likeTipIn}
              onChange={(e) => setLikeTipIn(e.target.value)}
            />
            <button
              type="button"
              className={`${btnPrimary} mb-4 w-full`}
              disabled={!canActSocial}
              onClick={() => void onSocialSetLikeTip()}
            >
              setLikeTipAmount
            </button>
            <p className={`${label} mb-1`}>Set reply stake (SNAP, 18 dp)</p>
            <input
              className={`${input} mb-2`}
              inputMode="decimal"
              placeholder="e.g. 2"
              value={replyStakeIn}
              onChange={(e) => setReplyStakeIn(e.target.value)}
            />
            <button
              type="button"
              className={`${btnPrimary} mb-4 w-full`}
              disabled={!canActSocial}
              onClick={() => void onSocialSetReplyStake()}
            >
              setReplyStakeAmount
            </button>
            <h3 className="mb-2 text-xs font-semibold text-white">Pause social</h3>
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canActSocial || socialPaused === true}
                className={btnDanger}
                onClick={onSocialPause}
              >
                Pause SnapZoSocial
              </button>
              <button
                type="button"
                disabled={!canActSocial || socialPaused === false}
                className={btnPrimary}
                onClick={onSocialUnpause}
              >
                Unpause SnapZoSocial
              </button>
            </div>
            <h3 className="mb-2 text-xs font-semibold text-white">Social relayers</h3>
            <input
              className={input}
              placeholder="Relayer 0x…"
              value={socialRelayerIn}
              onChange={(e) => setSocialRelayerIn(e.target.value)}
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={socialRelayerAllowed}
                onChange={(e) => setSocialRelayerAllowed(e.target.checked)}
              />
              Allowed
            </label>
            <button
              type="button"
              className={`${btnMuted} mt-2 w-full`}
              disabled={!canActSocial}
              onClick={onSocialSetRelayer}
            >
              setRelayer (social)
            </button>
          </section>
        ) : null}

        {rewardsOk ? (
          <section className={card}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">SnapZoCreators</h2>
              <button
                type="button"
                className="rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:bg-white/10"
                onClick={() => void rewardsReads.refetch()}
              >
                Refresh
              </button>
            </div>
            <p className="mb-2 text-[10px] text-zinc-500">
              Creators contract: <span className="font-mono">{rewards}</span>
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={miniAction}
                onClick={() => void copyAddress(rewards, "Rewards contract")}
              >
                Copy rewards
              </button>
              <a
                className={miniAction}
                href={`${explorerBase}/address/${rewards}`}
                target="_blank"
                rel="noreferrer"
              >
                Rewards on explorer
              </a>
            </div>
            <dl className="mb-4 grid gap-2 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Paused</dt>
                <dd className="font-medium text-zinc-200">
                  {rewardsPaused === undefined ? "…" : rewardsPaused ? "Yes" : "No"}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-zinc-500">Relayer</dt>
                <dd className="break-all font-mono text-[10px] text-zinc-300">
                  {rewardsRelayer ?? "…"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Last allocation update</dt>
                <dd className="font-mono text-zinc-200">
                  {rewardsLastUpdateTs === undefined
                    ? "…"
                    : new Date(Number(rewardsLastUpdateTs) * 1000).toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Reward token on rewards contract</dt>
                <dd
                  className="font-mono text-zinc-200"
                  title={fmtBalTitle(rewardOnRewardsContract)}
                >
                  {fmtBalShort(rewardOnRewardsContract)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Contract mode</dt>
                <dd className={rewardsIsCreatorsContract ? "font-medium text-emerald-300" : "font-medium text-amber-200"}>
                  {rewardsIsCreatorsContract ? "SnapZoCreators (claimable mapping)" : "Legacy Merkle rewards"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Hub linkage</dt>
                <dd
                  className={
                    rewardContractAddr &&
                    rewards &&
                    getAddress(rewardContractAddr as `0x${string}`) ===
                      getAddress(rewards as `0x${string}`)
                      ? "font-medium text-emerald-300"
                      : "font-medium text-amber-200"
                  }
                >
                  {rewardContractAddr &&
                  getAddress(rewardContractAddr as `0x${string}`) ===
                    getAddress(rewards as `0x${string}`)
                    ? "Hub → rewards linked"
                    : "Hub rewardContract mismatch"}
                </dd>
              </div>
            </dl>
            {!rewardsIsCreatorsContract ? (
              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                Connected rewards contract does not expose <span className="font-mono">MAX_BPS</span> /{" "}
                <span className="font-mono">setAllocations</span>. Point{" "}
                <span className="font-mono">NEXT_PUBLIC_SNAPZO_REWARDS_ADDRESS</span> and hub{" "}
                <span className="font-mono">rewardContract</span> to the SnapZoCreators deployment.
              </div>
            ) : null}
            <p className={label}>Preview claimable for user</p>
            <input
              className={`${input} mb-2`}
              placeholder="User 0x…"
              value={rewardsPreviewUserIn}
              onChange={(e) => setRewardsPreviewUserIn(e.target.value)}
            />
            <div className="mb-4 rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 font-mono text-[11px] text-zinc-300">
              {isAddress(rewardsPreviewUserIn.trim())
                ? `claimable = ${fmtBalShort(rewardsPreviewClaimable.data)} MEZO`
                : "Enter a valid user address to read claimable(user)."}
            </div>
            <p className={label}>Set rewards relayer</p>
            <input
              className={`${input} mb-2`}
              placeholder="Relayer 0x…"
              value={rewardsRelayerIn}
              onChange={(e) => setRewardsRelayerIn(e.target.value)}
            />
            <button
              type="button"
              className={`${btnMuted} mb-4 w-full`}
              disabled={!canActRewards}
              onClick={onRewardsSetRelayer}
            >
              setRelayer (rewards)
            </button>
            <p className={label}>Users (comma/newline separated)</p>
            <input
              className={`${input} mb-2`}
              placeholder="0xabc..., 0xdef..."
              value={rewardsUsersIn}
              onChange={(e) => setRewardsUsersIn(e.target.value)}
            />
            <p className={label}>Amounts in MEZO (same order)</p>
            <input
              className={`${input} mb-2`}
              placeholder="12.5, 22, 0.75"
              value={rewardsAmountsIn}
              onChange={(e) => setRewardsAmountsIn(e.target.value)}
            />
            <label className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={rewardsReset}
                onChange={(e) => setRewardsReset(e.target.checked)}
              />
              reset claimable instead of add
            </label>
            <button
              type="button"
              className={`${btnPrimary} mt-2 mb-4 w-full`}
              disabled={!canActRewards || !rewardsIsCreatorsContract}
              onClick={onRewardsSetAllocations}
            >
              setAllocations
            </button>
            <p className={label}>BPS list (same users order, sum 10000)</p>
            <input
              className={`${input} mb-2`}
              placeholder="7000, 3000"
              value={rewardsBpsIn}
              onChange={(e) => setRewardsBpsIn(e.target.value)}
            />
            <p className={label}>Pool amount in MEZO</p>
            <input
              className={`${input} mb-2`}
              placeholder="1000"
              value={rewardsPoolIn}
              onChange={(e) => setRewardsPoolIn(e.target.value)}
            />
            <button
              type="button"
              className={`${btnMuted} mb-4 w-full`}
              disabled={!canActRewards || !rewardsIsCreatorsContract}
              onClick={onRewardsSetAllocationsByBps}
            >
              setAllocationsByBps
            </button>
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canActRewards || rewardsPaused === true}
                className={btnDanger}
                onClick={onRewardsPause}
              >
                Pause rewards
              </button>
              <button
                type="button"
                disabled={!canActRewards || rewardsPaused === false}
                className={btnPrimary}
                onClick={onRewardsUnpause}
              >
                Unpause rewards
              </button>
            </div>
            <p className={label}>withdrawUnclaimed (owner, after 60 days inactivity)</p>
            <input
              className={input}
              placeholder="Amount (MEZO, 18 dp)"
              value={withdrawUnclaimedIn}
              onChange={(e) => setWithdrawUnclaimedIn(e.target.value)}
            />
            <button
              type="button"
              className={`${btnDanger} mt-2 w-full`}
              disabled={!canActRewards}
              onClick={onRewardsWithdrawUnclaimed}
            >
              withdrawUnclaimed
            </button>
          </section>
        ) : null}

        {rewardsOk ? (
          <div className="mb-6">
            <SnapZoRewardsClaimPanel />
          </div>
        ) : null}

        {hubOk ? (
          <>
        <section className={card}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Pause</h2>
            <button type="button" className={miniAction} onClick={() => setPauseOpen((v) => !v)}>
              {pauseOpen ? "Collapse" : "Expand"}
            </button>
          </div>
          {pauseOpen ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!canAct || paused === true} className={btnDanger} onClick={onPause}>
                Pause hub
              </button>
              <button
                type="button"
                disabled={!canAct || paused === false}
                className={btnPrimary}
                onClick={onUnpause}
              >
                Unpause hub
              </button>
            </div>
          ) : null}
        </section>

        <section className={card}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Relayers</h2>
            <button type="button" className={miniAction} onClick={() => setRelayersOpen((v) => !v)}>
              {relayersOpen ? "Collapse" : "Expand"}
            </button>
          </div>
          {relayersOpen ? (
            <>
              <p className="mb-2 text-[10px] text-zinc-500">
                Relayers from block <span className="font-mono">{String(SNAPZO_HUB_DEPLOY_BLOCK)}</span>.
              </p>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:bg-white/10"
                  onClick={() => void relayersListQuery.refetch()}
                >
                  Refresh relayer list
                </button>
                {relayersListQuery.isFetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" aria-hidden />
                ) : null}
              </div>
              {relayersListQuery.isError ? (
                <p className="mb-2 text-xs text-red-300/90">
                  {(relayersListQuery.error as Error)?.message ?? "Could not load relayer logs."}
                </p>
              ) : null}
              <ul className="mb-3 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/[0.06] bg-black/25 p-2 text-[11px]">
                {relayersListQuery.data?.length ? (
                  relayersListQuery.data.map((r) => (
                    <li
                      key={r.address}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 font-mono text-zinc-200 hover:bg-white/[0.04]"
                    >
                      <span className="min-w-0 flex-1 break-all">{r.address}</span>
                      <span
                        className={
                          r.isRelayerOnChain ? "shrink-0 text-emerald-400" : "shrink-0 text-amber-300"
                        }
                      >
                        {r.isRelayerOnChain ? "isRelayer ✓" : "log vs chain mismatch"}
                      </span>
                      <a
                        className="shrink-0 text-sky-400/90 underline-offset-2 hover:underline"
                        href={`${mezoTestnet.blockExplorers.default.url}/address/${r.address}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Explorer
                      </a>
                    </li>
                  ))
                ) : relayersListQuery.isPending ? (
                  <li className="px-2 py-2 text-zinc-500">Loading…</li>
                ) : (
                  <li className="px-2 py-2 text-zinc-500">No allowlisted relayers in log range.</li>
                )}
              </ul>
              <p className="mb-3 text-[10px] text-zinc-500">
                Relay txs need high gas limits; low gas causes failures.
              </p>
              <input
                className={input}
                placeholder="Relayer 0x…"
                value={relayerIn}
                onChange={(e) => setRelayerIn(e.target.value)}
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={relayerAllowed}
                  onChange={(e) => setRelayerAllowed(e.target.checked)}
                />
                Allowed
              </label>
              <button
                type="button"
                className={`${btnMuted} mt-2 w-full`}
                disabled={!canAct}
                onClick={onSetRelayer}
              >
                setRelayer
              </button>
            </>
          ) : null}
        </section>

        <section className={card}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Fee config</h2>
            <button type="button" className={miniAction} onClick={() => setFeeConfigOpen((v) => !v)}>
              {feeConfigOpen ? "Collapse" : "Expand"}
            </button>
          </div>
          {feeConfigOpen ? (
            <>
              <input
                className={`${input} mb-2`}
                placeholder="feeBps (0–2000)"
                value={feeBpsIn}
                onChange={(e) => setFeeBpsIn(e.target.value)}
              />
              <input
                className={input}
                placeholder="New feeReceiver (0x… or leave blank to keep)"
                value={feeRecvIn}
                onChange={(e) => setFeeRecvIn(e.target.value)}
              />
              <button
                type="button"
                className={`${btnMuted} mt-2 w-full`}
                disabled={!canAct}
                onClick={onSetFee}
              >
                setFee
              </button>
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <p className={label}>Rewards contract link (hub)</p>
                <p className="mb-2 text-[10px] text-zinc-600">
                  Set <span className="font-mono">hub.rewardContract</span>.
                </p>
                <input
                  className={input}
                  placeholder="SnapZoRewards 0x…"
                  value={hubRewardContractIn}
                  onChange={(e) => setHubRewardContractIn(e.target.value)}
                />
                <button
                  type="button"
                  className={`${btnMuted} mt-2 w-full`}
                  disabled={!canAct}
                  onClick={onSetHubRewardContract}
                >
                  setRewardContract
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section className={card}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-amber-200/90">Danger zone</h2>
            <button type="button" className={miniAction} onClick={() => setDangerOpen((v) => !v)}>
              {dangerOpen ? "Collapse" : "Expand"}
            </button>
          </div>
          {dangerOpen ? (
            <>
              <p className="mb-3 text-[10px] text-zinc-500">
                Advanced paused-only admin actions.
              </p>
              <p className={`${label} text-zinc-400`}>setIntegrations (paused)</p>
              <div className="mb-2 grid gap-2">
                <input className={input} placeholder="MUSD" value={intMusd} onChange={(e) => setIntMusd(e.target.value)} />
                <input className={input} placeholder="Vault" value={intVault} onChange={(e) => setIntVault(e.target.value)} />
                <input className={input} placeholder="Gauge" value={intGauge} onChange={(e) => setIntGauge(e.target.value)} />
                <input className={input} placeholder="Router" value={intRouter} onChange={(e) => setIntRouter(e.target.value)} />
                <input className={input} placeholder="Reward token" value={intReward} onChange={(e) => setIntReward(e.target.value)} />
              </div>
              <button type="button" disabled={!canAct} className={btnDanger} onClick={() => void onSetIntegrations()}>
                setIntegrations
              </button>
              <p className={`${label} mt-4 text-zinc-400`}>setRestakeRoutes (paused)</p>
              <textarea
                className={`${input} min-h-[72px] font-mono text-xs`}
                placeholder="0x… ABI-encoded routes bytes"
                value={routesHex}
                onChange={(e) => setRoutesHex(e.target.value)}
              />
              <button type="button" disabled={!canAct} className={`${btnDanger} mt-2`} onClick={() => void onSetRoutes()}>
                setRestakeRoutes
              </button>
              <p className={`${label} mt-4 text-zinc-400`}>sweep (paused)</p>
              <input
                className={`${input} mb-2`}
                placeholder="Token 0x…"
                value={sweepToken}
                onChange={(e) => setSweepToken(e.target.value)}
              />
              <input
                className={input}
                placeholder="Amount (18 dp)"
                value={sweepAmt}
                onChange={(e) => setSweepAmt(e.target.value)}
              />
              <button type="button" disabled={!canAct} className={`${btnDanger} mt-2`} onClick={() => void onSweep()}>
                sweep → owner
              </button>
            </>
          ) : null}
        </section>
          </>
        ) : null}
        </div>
      </div>
    </main>
  );
}
