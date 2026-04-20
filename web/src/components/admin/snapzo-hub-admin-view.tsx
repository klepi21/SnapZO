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
  maxUint256,
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

import { MusdInlineIcon } from "@/components/icons/musd-inline-icon";
import { SnapInlineIcon } from "@/components/icons/snap-inline-icon";
import { MezoInlineIcon } from "@/components/icons/mezo-inline-icon";
import { useSnapzoToast } from "@/components/providers/snapzo-toast-provider";
import { mezoTestnet } from "@/lib/chains/mezo-testnet";
import { erc20AllowanceAbi, erc20ApproveAbi } from "@/lib/constants/mezo-dex";
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

function fmtBal(v: bigint | undefined, d = MUSD_DECIMALS): string {
  if (v === undefined) {
    return "…";
  }
  return formatUnits(v, d);
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
  const [injectIn, setInjectIn] = useState("");
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
  const [rewardsCycleIn, setRewardsCycleIn] = useState("");
  const [rewardsRootIn, setRewardsRootIn] = useState("");
  const [withdrawUnclaimedIn, setWithdrawUnclaimedIn] = useState("");
  const [rootQueryCycleIn, setRootQueryCycleIn] = useState("");

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

  const rootQueryCycle = useMemo(() => {
    const t = rootQueryCycleIn.trim();
    if (!/^\d+$/.test(t)) return undefined;
    return BigInt(t);
  }, [rootQueryCycleIn]);

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
      {
        chainId: mezoTestnet.id,
        address: rewards,
        abi: snapZoRewardsAbi,
        functionName: "roots",
        args: rootQueryCycle !== undefined ? [rootQueryCycle] : undefined,
      },
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
  const rewardsRootQueryValue =
    rewardsReads.data?.[5]?.status === "success" ? rewardsReads.data[5].result : undefined;

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

  const injectParsed = useMemo(() => {
    const t = injectIn.trim().replace(",", ".");
    if (!t) {
      return undefined;
    }
    try {
      return parseUnits(t, MUSD_DECIMALS);
    } catch {
      return undefined;
    }
  }, [injectIn]);

  const injectAllowance = useReadContract({
    chainId: mezoTestnet.id,
    address: MUSD_ADDRESS_MEZO_TESTNET,
    abi: erc20AllowanceAbi,
    functionName: "allowance",
    args:
      address && injectParsed !== undefined && injectParsed > BigInt(0)
        ? [address, hub]
        : undefined,
    query: {
      enabled: Boolean(
        hubOk &&
          isHubOwner &&
          address &&
          injectParsed !== undefined &&
          injectParsed > BigInt(0),
      ),
      staleTime: 0,
      refetchOnWindowFocus: true,
    },
  });

  const refetchAll = useCallback(async () => {
    await hubReads.refetch();
    await socialReads.refetch();
    await rewardsReads.refetch();
    await smusdShareReads.refetch();
    await secondaryReads.refetch();
    await injectAllowance.refetch();
    await queryClient.invalidateQueries({ queryKey: ["snapzoHubRelayers"] });
  }, [
    hubReads,
    injectAllowance,
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
        toast("Connect the SnapZoRewards owner wallet.", "error");
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
    if (!Number.isFinite(b) || b < 0 || b > 1000) {
      toast("feeBps must be 0–1000 (MAX_FEE_BPS on hub).", "error");
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

  const onInject = async () => {
    if (!injectParsed || injectParsed === BigInt(0)) {
      toast("Enter MUSD amount.", "error");
      return;
    }
    await runHubWrite("MUSD injected (no SNAP mint)", async () => {
      const need =
        injectAllowance.data !== undefined ? injectParsed > injectAllowance.data : true;
      if (need) {
        toast("Approve hub for MUSD…");
        const h = await writeContractAsync({
          chainId: mezoTestnet.id,
          address: MUSD_ADDRESS_MEZO_TESTNET,
          abi: erc20ApproveAbi,
          functionName: "approve",
          args: [hub, maxUint256],
        });
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: h });
        }
        await injectAllowance.refetch();
      }
      return writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "injectMusdWithoutMint",
        args: [injectParsed],
      });
    });
    setInjectIn("");
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

  const onRewardsUpdateRoot = () => {
    const cycleRaw = rewardsCycleIn.trim();
    if (!/^\d+$/.test(cycleRaw)) {
      toast("Cycle must be an integer (e.g. 1).", "error");
      return;
    }
    const rootRaw = rewardsRootIn.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(rootRaw)) {
      toast("Root must be 0x + 64 hex chars.", "error");
      return;
    }
    void runRewardsWrite("Rewards root updated", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: rewards,
        abi: snapZoRewardsAbi,
        functionName: "updateRoot",
        args: [BigInt(cycleRaw), rootRaw as `0x${string}`],
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
    "rounded-2xl border border-white/[0.08] bg-zinc-900/55 p-4 shadow-inner backdrop-blur-sm";
  const label = "mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500";
  const input =
    "w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 font-mono text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-500/40";
  const btnPrimary =
    "inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40";
  const btnDanger =
    "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-red-500/40 bg-red-500/15 px-4 text-sm font-semibold text-red-200 transition hover:bg-red-500/25 disabled:opacity-40";
  const btnMuted =
    "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-semibold text-zinc-100 transition hover:bg-white/10 disabled:opacity-40";
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
    <main className="px-4 pb-32 pt-5">
      <div className="mb-5 flex items-start gap-3">
        <Link
          href="/earn"
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-black/30 text-white transition hover:bg-white/10"
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
          Connected wallet is not the SnapZoRewards owner ({String(rewardsOwner).slice(0, 6)}…).
          Rewards admin actions are disabled.
        </div>
      ) : null}

      <div className="space-y-4">
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
            <p className="mb-3 text-[10px] leading-relaxed text-zinc-600">
              Gasless tips, unlocks, and reply escrow (
              <span className="font-mono">{social}</span>). Same deployer is often owner on both
              contracts — connect the owner wallet.
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
              <h2 className="text-sm font-semibold text-white">SnapZoRewards</h2>
              <button
                type="button"
                className="rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:bg-white/10"
                onClick={() => void rewardsReads.refetch()}
              >
                Refresh
              </button>
            </div>
            <p className="mb-3 text-[10px] leading-relaxed text-zinc-600">
              Merkle MEZO distributor (<span className="font-mono">{rewards}</span>) used by the hub
              fee split path when <span className="font-mono">rewardContract</span> is configured.
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
                <dt className="text-zinc-500">Last root update</dt>
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
            <p className={label}>Query cycle root</p>
            <input
              className={`${input} mb-2`}
              placeholder="Cycle (e.g. 1)"
              value={rootQueryCycleIn}
              onChange={(e) => setRootQueryCycleIn(e.target.value)}
            />
            <div className="mb-4 break-all rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 font-mono text-[10px] text-zinc-300">
              {rootQueryCycleIn.trim() === ""
                ? "Enter cycle to read roots(cycle)."
                : rewardsRootQueryValue ?? "…"}
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
            <p className={label}>Update Merkle root</p>
            <input
              className={`${input} mb-2`}
              placeholder="Cycle (uint256)"
              value={rewardsCycleIn}
              onChange={(e) => setRewardsCycleIn(e.target.value)}
            />
            <input
              className={input}
              placeholder="Root 0x + 64 hex chars"
              value={rewardsRootIn}
              onChange={(e) => setRewardsRootIn(e.target.value)}
            />
            <button
              type="button"
              className={`${btnPrimary} mt-2 mb-4 w-full`}
              disabled={!canActRewards}
              onClick={onRewardsUpdateRoot}
            >
              updateRoot
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

        {hubOk ? (
          <>
          <section className={card}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Hub status</h2>
            <button
              type="button"
              className="rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:bg-white/10"
              onClick={() => void refetchAll()}
            >
              Refresh
            </button>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={miniAction}
              onClick={() => void copyAddress(hub, "Hub")}
            >
              Copy hub
            </button>
            <a
              className={miniAction}
              href={`${explorerBase}/address/${hub}`}
              target="_blank"
              rel="noreferrer"
            >
              Hub on explorer
            </a>
            <button
              type="button"
              className={miniAction}
              onClick={() => void copyAddress(rewardTokenAddr, "Reward token")}
            >
              Copy reward token
            </button>
            <button
              type="button"
              className={miniAction}
              onClick={() => void copyAddress(rewardContractAddr, "Hub reward contract")}
            >
              Copy hub rewardContract
            </button>
            {rewardTokenAddr && isAddress(rewardTokenAddr) ? (
              <a
                className={miniAction}
                href={`${explorerBase}/address/${rewardTokenAddr}`}
                target="_blank"
                rel="noreferrer"
              >
                Reward token on explorer
              </a>
            ) : null}
            {rewardContractAddr && isAddress(rewardContractAddr) ? (
              <a
                className={miniAction}
                href={`${explorerBase}/address/${rewardContractAddr}`}
                target="_blank"
                rel="noreferrer"
              >
                Hub rewardContract on explorer
              </a>
            ) : null}
          </div>
          <dl className="grid gap-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Paused</dt>
              <dd className="font-medium text-zinc-200">{paused === undefined ? "…" : paused ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Fee bps</dt>
              <dd className="font-mono text-zinc-200">{feeBps === undefined ? "…" : String(feeBps)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-zinc-500">Fee recipient</dt>
              <dd className="break-all font-mono text-[10px] text-zinc-300">
                {feeReceiver ?? "…"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-zinc-500">Reward contract</dt>
              <dd className="break-all font-mono text-[10px] text-zinc-300">
                {rewardContractAddr ?? "…"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">sMUSD on hub</dt>
                <dd
                  className="font-mono text-zinc-200"
                  title={fmtBalTitle(smusdTotalWei, SMUSD_DECIMALS)}
                >
                  {fmtBalShort(smusdTotalWei, 6, SMUSD_DECIMALS)}
                </dd>
              </div>
              <p className="text-[10px] leading-snug text-zinc-600">
                <span className="font-mono">vault.balanceOf(hub) + gauge.balanceOf(hub)</span> — vault
                share wei (18 decimals). SNAP mints 1:1 with{" "}
                <strong className="text-zinc-500">Δ</strong> of this total on each deposit.
              </p>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="flex items-center gap-1 text-zinc-500">
                <MusdInlineIcon decorative />
                MUSD idle on hub
              </dt>
              <dd className="font-mono text-zinc-200" title={fmtBalTitle(musdOnHub)}>
                {fmtBalShort(musdOnHub)}
              </dd>
            </div>
          </dl>
        </section>

        <section className={card}>
          <h2 className="mb-3 text-sm font-semibold text-white">Rewards &amp; treasury</h2>
          <dl className="mb-4 grid gap-2 text-xs">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-2">
              <dt className="text-zinc-500">Gauge earned (pending)</dt>
              <dd
                className="font-mono text-emerald-200/90 sm:text-right"
                title={fmtBalTitle(earnedGauge)}
              >
                {fmtBalShort(earnedGauge)}
              </dd>
            </div>
            <p className="col-span-full text-[10px] leading-snug text-zinc-600">
              <span className="font-mono">gauge.earned(hub)</span> is emissions still in the gauge
              contract. <strong>Harvest</strong> or <strong>Sync gauge</strong> calls{" "}
              <span className="font-mono">getReward</span> into the hub and increases the SNAP reward
              index (no fee on claim). <strong>Restake</strong> only moves idle MUSD; it does not swap
              hub-held reward tokens.
            </p>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Reward token on hub</dt>
              <dd className="font-mono text-zinc-200" title={fmtBalTitle(rewardOnHub)}>
                {fmtBalShort(rewardOnHub)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Reward token on fee recipient</dt>
              <dd className="font-mono text-amber-100/90" title={fmtBalTitle(rewardOnFeeReceiver)}>
                {fmtBalShort(rewardOnFeeReceiver)}
              </dd>
            </div>
            <p className="col-span-full text-[10px] leading-snug text-zinc-600">
              The fee recipient balance is mostly from the <strong><MezoInlineIcon decorative /> MEZO leg on user withdraws</strong>{" "}
              (<span className="font-mono">feeBps</span>), not from harvest.
            </p>
          </dl>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button type="button" disabled={!canAct} className={btnPrimary} onClick={onHarvest}>
              {(busy || isWritePending) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Harvest (relayer / owner)
            </button>
            <button type="button" disabled={!canAct} className={btnPrimary} onClick={onSyncGaugeRewards}>
              Sync gauge (owner)
            </button>
            <button type="button" disabled={!canAct} className={btnMuted} onClick={onRestake}>
              Restake
            </button>
            <button type="button" disabled={!canAct} className={btnMuted} onClick={onRecoverAllToSelf}>
              Recover hub rewards → me
            </button>
          </div>
          <p className="mt-3 text-[10px] text-zinc-600">
            Harvest and Sync gauge both call <span className="font-mono">gauge.getReward(hub)</span> and
            index <MezoInlineIcon decorative /> MEZO to SNAP holders. <span className="font-mono">recoverRewardToken</span> is only
            allowed while <strong>paused</strong>.
          </p>
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <p className={label}>Fee recipient → payout reward token</p>
            <p className="mb-2 text-[10px] text-zinc-600">
              Connect the <span className="font-mono">feeReceiver</span> wallet. Sends the{" "}
              <strong>full refreshed</strong> reward balance to the hub <strong>owner</strong> by
              default (ERC-20 <span className="font-mono">transfer</span> to yourself is a no-op).
            </p>
            <input
              className={`${input} mb-2`}
              placeholder="Optional recipient 0x… (defaults to hub owner)"
              value={feePayoutTo}
              onChange={(e) => setFeePayoutTo(e.target.value)}
            />
            <button
              type="button"
              disabled={
                !treasuryCan || !rewardOnFeeReceiver || rewardOnFeeReceiver === BigInt(0)
              }
              className={btnMuted}
              onClick={() => void onTreasuryTransferOut()}
            >
              Send all fee-recipient rewards → owner
            </button>
          </div>
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <p className={label}>Custom recover</p>
            <input
              className={`${input} mb-2`}
              placeholder="Recipient 0x…"
              value={recoverTo}
              onChange={(e) => setRecoverTo(e.target.value)}
            />
            <input
              className={input}
              placeholder="Amount (reward token, 18 dp)"
              value={recoverAmt}
              onChange={(e) => setRecoverAmt(e.target.value)}
            />
            <button
              type="button"
              className={`${btnMuted} mt-2 w-full sm:w-auto`}
              disabled={!canAct}
              onClick={() => void onRecoverReward()}
            >
              recoverRewardToken
            </button>
          </div>
        </section>

        <section className={card}>
          <h2 className="mb-3 text-sm font-semibold text-white">Pause</h2>
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
        </section>

        <section className={card}>
          <h2 className="mb-3 text-sm font-semibold text-white">Inject MUSD (no SNAP)</h2>
          <p className="mb-2 text-[10px] text-zinc-600">
            Approve MUSD to the hub, then pull from your wallet into vault/gauge via{" "}
            <span className="font-mono">injectMusdWithoutMint</span>.
          </p>
          <input
            className={input}
            inputMode="decimal"
            placeholder="0.00 MUSD"
            value={injectIn}
            onChange={(e) => setInjectIn(e.target.value)}
          />
          <button
            type="button"
            className={`${btnPrimary} mt-2 w-full`}
            disabled={!canAct}
            onClick={() => void onInject()}
          >
            Inject
          </button>
        </section>

        <section className={card}>
          <h2 className="mb-3 text-sm font-semibold text-white">Relayers</h2>
          <p className="mb-2 text-[10px] leading-relaxed text-zinc-600">
            Allowlist from <span className="font-mono">RelayerUpdated</span> since deploy block{" "}
            <span className="font-mono">{String(SNAPZO_HUB_DEPLOY_BLOCK)}</span> (override with{" "}
            <span className="font-mono">NEXT_PUBLIC_SNAPZO_HUB_DEPLOY_BLOCK</span> if you redeploy).
            Each address is re-checked with <span className="font-mono">isRelayer</span>.
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
          <p className="mb-3 text-[10px] leading-relaxed text-zinc-600">
            <strong>Relay gas:</strong> <span className="font-mono">depositWithSig</span> /{" "}
            <span className="font-mono">withdrawWithSig</span> need hundreds of thousands of gas. A
            failed tx with <span className="font-mono">gasLimit ≈ 23380</span> (see{" "}
            <a
              className="text-sky-400/90 underline-offset-2 hover:underline"
              href="https://explorer.test.mezo.org/tx/0x2f51e6f83e138170fa8ff37942f3dd93834c6048229d4750d6d233698c1291e7"
              target="_blank"
              rel="noreferrer"
            >
              example
            </a>
            ) ran out of gas, not necessarily a bad private key. Use the app relay routes (they
            estimate gas + buffer) or set a high manual gas cap.
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
        </section>

        <section className={card}>
          <h2 className="mb-3 text-sm font-semibold text-white">Fee config</h2>
          <input
            className={`${input} mb-2`}
            placeholder="feeBps (0–1000)"
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
              Set <span className="font-mono">hub.rewardContract</span>. When configured, withdraw
              fee is forced to 20% and split 10% treasury / 10% rewards contract.
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
        </section>

        <section className={card}>
          <h2 className="mb-3 text-sm font-semibold text-amber-200/90">Danger zone</h2>
          <p className="mb-3 text-[10px] text-zinc-500">
            <span className="font-mono">setIntegrations</span> and{" "}
            <span className="font-mono">setRestakeRoutes</span> require the hub to be{" "}
            <strong>paused</strong>. <span className="font-mono">sweep</span> only while paused; cannot
            target MUSD, SNAP, reward token, or vault token per contract denylist.
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
        </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
