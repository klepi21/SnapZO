"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Loader2 } from "lucide-react";

import { HelpPopover } from "@/components/ui/help-popover";
import {
  UserRejectedRequestError,
  formatUnits,
  getAddress,
  maxUint256,
  parseUnits,
} from "viem";
import { getPublicClient } from "wagmi/actions";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSignTypedData,
  useSwitchChain,
  useWalletClient,
  useWriteContract,
} from "wagmi";

import { MusdInlineIcon } from "@/components/icons/musd-inline-icon";
import { MezoInlineIcon } from "@/components/icons/mezo-inline-icon";
import { SnapInlineIcon } from "@/components/icons/snap-inline-icon";
import { useSnapzoToast } from "@/components/providers/snapzo-toast-provider";
import { mezoTestnet } from "@/lib/chains/mezo-testnet";
import { erc20AllowanceAbi, erc20ApproveAbi } from "@/lib/constants/mezo-dex";
import {
  erc20TotalSupplyAbi,
  isSnapZoHubConfigured,
  SNAP_DECIMALS,
  SNAPZO_HUB_ADDRESS,
  SNAPZO_SNAP_TOKEN_ADDRESS,
  snapZoHubAbi,
} from "@/lib/constants/snapzo-hub";
import {
  MEZO_MUSD_VAULT,
  MEZO_SMUSD_GAUGE,
  mezoMusdVaultAbi,
  mezoSmusdGaugeAbi,
} from "@/lib/constants/mezo-earn";
import {
  erc20BalanceAbi,
  MUSD_ADDRESS_MEZO_TESTNET,
  MUSD_DECIMALS,
} from "@/lib/constants/musd";
import {
  snapZoHubDomain,
  snapZoDepositTypes,
  snapZoWithdrawTypes,
} from "@/lib/snapzo/eip712";
import { wagmiConfig } from "@/lib/wagmi/config";
import {
  pickWithdrawDisplayMusdWei,
  snapWithdrawToFreeSharesFloor,
} from "@/lib/snapzo/preview-withdraw-musd";

const ZERO = BigInt(0);
const BPS = BigInt(10_000);
const MIN_DEPOSIT_WEI = BigInt("1000000000000000000");
const DEADLINE_SECS = BigInt(3600);
/** One full MUSD unit in wei — used for marginal `convertToShares` rate (same as deposit preview). */
const ONE_MUSD_WEI = parseUnits("1", MUSD_DECIMALS);

/**
 * Mirrors `SnapZoHub._withdraw` MEZO leg before an extra `getReward` in the same tx:
 * gross = floor(earned × withdrawSnap ÷ balance), fee on gross, net = gross − fee.
 */
function previewWithdrawMezoWei(args: {
  earnedWei: bigint;
  snapBalanceWei: bigint;
  withdrawSnapWei: bigint;
  feeBps: bigint;
}): { grossWei: bigint; feeWei: bigint; netWei: bigint } | undefined {
  const { earnedWei, snapBalanceWei, withdrawSnapWei, feeBps } = args;
  if (snapBalanceWei <= ZERO || withdrawSnapWei <= ZERO || withdrawSnapWei > snapBalanceWei) {
    return undefined;
  }
  let gross = (earnedWei * withdrawSnapWei) / snapBalanceWei;
  if (gross > earnedWei) {
    gross = earnedWei;
  }
  const fee = (gross * feeBps) / BPS;
  return { grossWei: gross, feeWei: fee, netWei: gross - fee };
}

type HubMode = "deposit" | "withdraw";

function formatUnitsMax2dp(value: bigint | undefined, decimals: number): string {
  if (value === undefined) {
    return "0.00";
  }
  const full = formatUnits(value, decimals);
  const dot = full.indexOf(".");
  if (dot === -1) {
    return full;
  }
  const intPart = full.slice(0, dot);
  const frac = full.slice(dot + 1);
  const head = frac.slice(0, 2);
  const fracTrim = head.replace(/0+$/, "");
  if (fracTrim.length === 0) {
    return intPart;
  }
  return `${intPart}.${fracTrim}`;
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
    return e.message.slice(0, 200);
  }
  return "Something went wrong.";
}

function txToast(hash: `0x${string}`, label: string) {
  const base = mezoTestnet.blockExplorers.default.url;
  return {
    title: label,
    subtitle: "Opens in Mezo explorer.",
    link: {
      href: `${base}/tx/${hash}`,
      label: `View · ${hash.slice(0, 8)}…${hash.slice(-6)}`,
    },
  } as const;
}

function parsedMusdAmount(s: string): bigint | undefined {
  const t = s.trim().replace(",", ".");
  if (!t) {
    return undefined;
  }
  try {
    return parseUnits(t, MUSD_DECIMALS);
  } catch {
    return undefined;
  }
}

function parsedSnapAmount(s: string): bigint | undefined {
  const t = s.trim().replace(",", ".");
  if (!t) {
    return undefined;
  }
  try {
    return parseUnits(t, SNAP_DECIMALS);
  } catch {
    return undefined;
  }
}

const VAULT_SHARES_PER_ONE_MUSD_QUERY_KEY = "mezoVaultConvertToShares1Musd" as const;

export function SnapZoHubEarnPanel() {
  const configured = isSnapZoHubConfigured();
  const queryClient = useQueryClient();
  const toast = useSnapzoToast();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { switchChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient({ chainId: mezoTestnet.id });
  const publicClient = usePublicClient({ chainId: mezoTestnet.id });
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const { signTypedDataAsync, isPending: isSignPending } = useSignTypedData();

  const [busy, setBusy] = useState(false);
  const [hubMode, setHubMode] = useState<HubMode>("deposit");
  const [hubDepositIn, setHubDepositIn] = useState("");
  const [hubWithdrawIn, setHubWithdrawIn] = useState("");

  const wrongChain = isConnected && chainId !== mezoTestnet.id;
  const canAct = isConnected && !wrongChain && !busy && !isWritePending && !isSignPending;

  const musdBal = useReadContract({
    chainId: mezoTestnet.id,
    address: MUSD_ADDRESS_MEZO_TESTNET,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(
        configured && isConnected && address && chainId === mezoTestnet.id,
      ),
    },
  });

  const snapBal = useReadContract({
    chainId: mezoTestnet.id,
    address: SNAPZO_SNAP_TOKEN_ADDRESS,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(
        configured && isConnected && address && chainId === mezoTestnet.id,
      ),
    },
  });

  const hubNonce = useReadContract({
    chainId: mezoTestnet.id,
    address: SNAPZO_HUB_ADDRESS,
    abi: snapZoHubAbi,
    functionName: "nonces",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(
        configured && isConnected && address && chainId === mezoTestnet.id,
      ),
    },
  });

  const hubFeeBps = useReadContract({
    chainId: mezoTestnet.id,
    address: SNAPZO_HUB_ADDRESS,
    abi: snapZoHubAbi,
    functionName: "feeBps",
    query: {
      enabled: Boolean(configured && chainId === mezoTestnet.id),
      staleTime: 60_000,
    },
  });

  const hubRewardContract = useReadContract({
    chainId: mezoTestnet.id,
    address: SNAPZO_HUB_ADDRESS,
    abi: snapZoHubAbi,
    functionName: "rewardContract",
    query: {
      enabled: Boolean(configured && chainId === mezoTestnet.id),
      staleTime: 60_000,
    },
  });

  const hubDepositParsed = useMemo(() => parsedMusdAmount(hubDepositIn), [hubDepositIn]);
  const hubWithdrawParsed = useMemo(() => parsedSnapAmount(hubWithdrawIn), [hubWithdrawIn]);

  const depositPreviewSnap = useReadContract({
    chainId: mezoTestnet.id,
    address: MEZO_MUSD_VAULT,
    abi: mezoMusdVaultAbi,
    functionName: "convertToShares",
    args:
      configured && hubDepositParsed !== undefined && hubDepositParsed > ZERO
        ? [hubDepositParsed]
        : undefined,
    query: {
      enabled: Boolean(
        configured &&
          hubDepositParsed !== undefined &&
          hubDepositParsed > ZERO,
      ),
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  });

  /**
   * Marginal MUSD→sMUSD rate via `getPublicClient` (same pattern as Earn vault stats).
   * `useReadContract` alone can fail under SSR / hydration while TVL fallback still runs — this path is stable.
   */
  const vaultSharesPerOneMusdQuery = useQuery({
    queryKey: [VAULT_SHARES_PER_ONE_MUSD_QUERY_KEY, mezoTestnet.id] as const,
    queryFn: async () => {
      const client = getPublicClient(wagmiConfig, { chainId: mezoTestnet.id });
      if (!client) {
        throw new Error("No RPC client");
      }
      return client.readContract({
        address: MEZO_MUSD_VAULT,
        abi: mezoMusdVaultAbi,
        functionName: "convertToShares",
        args: [ONE_MUSD_WEI],
      });
    },
    enabled: configured,
    staleTime: 30_000,
    gcTime: 300_000,
    retry: 3,
    refetchOnWindowFocus: true,
  });

  const hubWithdrawPositionReads = useReadContracts({
    contracts: [
      {
        chainId: mezoTestnet.id,
        address: MEZO_SMUSD_GAUGE,
        abi: mezoSmusdGaugeAbi,
        functionName: "balanceOf",
        args: [SNAPZO_HUB_ADDRESS],
      },
      {
        chainId: mezoTestnet.id,
        address: MEZO_MUSD_VAULT,
        abi: mezoMusdVaultAbi,
        functionName: "balanceOf",
        args: [SNAPZO_HUB_ADDRESS],
      },
      {
        chainId: mezoTestnet.id,
        address: SNAPZO_SNAP_TOKEN_ADDRESS,
        abi: erc20TotalSupplyAbi,
        functionName: "totalSupply",
      },
    ],
    query: {
      enabled: configured,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  });

  const hubEarnedForUser = useReadContract({
    chainId: mezoTestnet.id,
    address: SNAPZO_HUB_ADDRESS,
    abi: snapZoHubAbi,
    functionName: "earned",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(configured && address),
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  });

  const gaugeEarnedForHub = useReadContract({
    chainId: mezoTestnet.id,
    address: MEZO_SMUSD_GAUGE,
    abi: mezoSmusdGaugeAbi,
    functionName: "earned",
    args: [SNAPZO_HUB_ADDRESS],
    query: {
      enabled: configured,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  });

  const hubWithdrawPositionData = hubWithdrawPositionReads.data;
  const hubWithdrawPositionPending = hubWithdrawPositionReads.isPending;

  // Verify that the data array length matches what we expect for the current address state
  // to avoid index mismatch during transitions.
  const expectedLength = 3;
  const isDataStale = !hubWithdrawPositionData || hubWithdrawPositionData.length !== expectedLength;

  const smusdStakedOnHub =
    !isDataStale && hubWithdrawPositionData[0]?.status === "success"
      ? (hubWithdrawPositionData[0].result as bigint)
      : undefined;
  const smusdIdleOnHub =
    !isDataStale && hubWithdrawPositionData[1]?.status === "success"
      ? (hubWithdrawPositionData[1].result as bigint)
      : undefined;
  const snapTotalSupply =
    !isDataStale && hubWithdrawPositionData[2]?.status === "success"
      ? (hubWithdrawPositionData[2].result as bigint)
      : undefined;

  const hubEarnedMezoData = hubEarnedForUser.data;
  const gaugeEarnedForHubData = gaugeEarnedForHub.data;

  /**
   * Real-time MEZO for the connected user from the hub (gauge emissions only).
   * Combines:
   * 1. `hub.earned(user)` — already harvested & indexed via rewardPerTokenStored
   * 2. Pro-rata share of `gauge.earned(hub)` — pending unharvested gauge emissions
   * Note: this is separate from SnapZoRewards (creator Merkle rewards).
   */
  const userTotalMezoWei = useMemo(() => {
    // If hub.earned(user) is not available (reverted or not connected), fall back to just gauge share
    const indexed = hubEarnedMezoData ?? ZERO;
    const pendingGauge = gaugeEarnedForHubData ?? ZERO;
    const userBal = snapBal.data;
    const totalSnap = snapTotalSupply;
    // If we have neither hub earned nor any gauge data, show nothing
    if (hubEarnedMezoData === undefined && gaugeEarnedForHubData === undefined) {
      return undefined;
    }
    if (
      pendingGauge <= ZERO ||
      userBal === undefined ||
      userBal <= ZERO ||
      totalSnap === undefined ||
      totalSnap <= ZERO
    ) {
      return indexed;
    }
    const userShareOfPending = (pendingGauge * userBal) / totalSnap;
    return indexed + userShareOfPending;
  }, [hubEarnedMezoData, gaugeEarnedForHubData, snapBal.data, snapTotalSupply]);

  const hubTotalSmusdWei = useMemo(() => {
    if (smusdStakedOnHub === undefined || smusdIdleOnHub === undefined) {
      return undefined;
    }
    return smusdStakedOnHub + smusdIdleOnHub;
  }, [smusdIdleOnHub, smusdStakedOnHub]);

  const withdrawToFreeSharesWei = useMemo(() => {
    if (
      hubWithdrawParsed === undefined ||
      hubWithdrawParsed <= ZERO ||
      snapTotalSupply === undefined ||
      hubTotalSmusdWei === undefined
    ) {
      return undefined;
    }
    return snapWithdrawToFreeSharesFloor(
      hubWithdrawParsed,
      hubTotalSmusdWei,
      snapTotalSupply,
    );
  }, [hubTotalSmusdWei, hubWithdrawParsed, snapTotalSupply]);

  const sharesPerOneMusdWei =
    vaultSharesPerOneMusdQuery.isSuccess &&
    vaultSharesPerOneMusdQuery.data !== undefined &&
    vaultSharesPerOneMusdQuery.data > ZERO
      ? vaultSharesPerOneMusdQuery.data
      : undefined;

  /** MUSD implied by vault `convertToShares(1 MUSD)` marginal rate (often wrong vs wallet on testnet). */
  const withdrawVaultMarginalMusdWei = useMemo(() => {
    if (
      withdrawToFreeSharesWei === undefined ||
      withdrawToFreeSharesWei <= ZERO ||
      sharesPerOneMusdWei === undefined
    ) {
      return undefined;
    }
    return (withdrawToFreeSharesWei * ONE_MUSD_WEI) / sharesPerOneMusdWei;
  }, [sharesPerOneMusdWei, withdrawToFreeSharesWei]);

  const withdrawMusdDisplay = useMemo(
    () =>
      pickWithdrawDisplayMusdWei(withdrawToFreeSharesWei, withdrawVaultMarginalMusdWei),
    [withdrawToFreeSharesWei, withdrawVaultMarginalMusdWei],
  );

  const withdrawMezoPreview = useMemo(() => {
    if (
      hubWithdrawParsed === undefined ||
      hubWithdrawParsed <= ZERO ||
      snapBal.data === undefined ||
      snapBal.data <= ZERO ||
      hubWithdrawParsed > snapBal.data ||
      userTotalMezoWei === undefined
    ) {
      return undefined;
    }

    /**
     * If rewardContract is set, hub takes 20% (10% treasury, 10% Merkle creator rewards).
     * Otherwise it uses the base hub feeBps.
     */
    const activeFeeBps =
      hubRewardContract.data && hubRewardContract.data !== "0x0000000000000000000000000000000000000000"
        ? BigInt(2000)
        : hubFeeBps.data !== undefined
          ? BigInt(hubFeeBps.data)
          : undefined;

    if (activeFeeBps === undefined) {
      return undefined;
    }

    return previewWithdrawMezoWei({
      earnedWei: userTotalMezoWei,
      snapBalanceWei: snapBal.data,
      withdrawSnapWei: hubWithdrawParsed,
      feeBps: activeFeeBps,
    });
  }, [userTotalMezoWei, hubFeeBps.data, hubRewardContract.data, hubWithdrawParsed, snapBal.data]);

  const withdrawPoolReady = useMemo(
    () =>
      hubWithdrawParsed !== undefined &&
      hubWithdrawParsed > ZERO &&
      snapTotalSupply !== undefined &&
      snapTotalSupply > ZERO &&
      hubTotalSmusdWei !== undefined &&
      hubTotalSmusdWei > ZERO,
    [hubTotalSmusdWei, hubWithdrawParsed, snapTotalSupply],
  );

  const musdAllowHub = useReadContract({
    chainId: mezoTestnet.id,
    address: MUSD_ADDRESS_MEZO_TESTNET,
    abi: erc20AllowanceAbi,
    functionName: "allowance",
    args:
      address && hubDepositParsed !== undefined && hubDepositParsed > ZERO
        ? [address, SNAPZO_HUB_ADDRESS]
        : undefined,
    query: {
      enabled: Boolean(
        configured &&
          isConnected &&
          address &&
          chainId === mezoTestnet.id &&
          hubDepositParsed !== undefined &&
          hubDepositParsed > ZERO,
      ),
    },
  });

  const refetchHub = useCallback(async () => {
    await musdBal.refetch();
    await snapBal.refetch();
    await hubNonce.refetch();
    await hubFeeBps.refetch();
    await hubRewardContract.refetch();
    await hubEarnedForUser.refetch();
    await gaugeEarnedForHub.refetch();
    await musdAllowHub.refetch();
    await depositPreviewSnap.refetch();
    await hubWithdrawPositionReads.refetch();
    await queryClient.invalidateQueries({ queryKey: [VAULT_SHARES_PER_ONE_MUSD_QUERY_KEY] });
    await vaultSharesPerOneMusdQuery.refetch();
  }, [
    depositPreviewSnap,
    hubFeeBps,
    hubEarnedForUser,
    hubRewardContract,
    hubNonce,
    hubWithdrawPositionReads,
    gaugeEarnedForHub,
    musdAllowHub,
    musdBal,
    queryClient,
    snapBal,
    vaultSharesPerOneMusdQuery,
  ]);

  const addSnapToWallet = useCallback(async () => {
    if (!walletClient) {
      toast("Connect on Mezo testnet to add SNAP.", "error");
      return;
    }
    try {
      await walletClient.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: SNAPZO_SNAP_TOKEN_ADDRESS,
            symbol: "SNAP",
            decimals: SNAP_DECIMALS,
          },
        },
      });
      toast("SNAP added to your wallet list.");
    } catch (e) {
      toast(formatTxError(e), "error");
    }
  }, [toast, walletClient]);

  const runHubDeposit = useCallback(async () => {
    if (!isConnected || !address || wrongChain) {
      return;
    }
    const amt = hubDepositParsed;
    if (!amt || amt <= ZERO) {
      toast("Enter a MUSD amount.", "error");
      return;
    }
    if (amt < MIN_DEPOSIT_WEI) {
      toast("Minimum deposit is 1 MUSD.", "error");
      return;
    }
    setBusy(true);
    try {
      const need =
        musdAllowHub.data !== undefined ? amt > musdAllowHub.data : true;
      if (need) {
        toast("Approve hub in your wallet…");
        const h = await writeContractAsync({
          chainId: mezoTestnet.id,
          address: MUSD_ADDRESS_MEZO_TESTNET,
          abi: erc20ApproveAbi,
          functionName: "approve",
          args: [SNAPZO_HUB_ADDRESS, maxUint256],
        });
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: h });
        }
        await musdAllowHub.refetch();
      }

      const nonceRes = await hubNonce.refetch();
      const nonce = nonceRes.data ?? ZERO;
      const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SECS;

      toast("Sign deposit intent in your wallet…");
      const signature = await signTypedDataAsync({
        domain: snapZoHubDomain(SNAPZO_HUB_ADDRESS),
        types: snapZoDepositTypes,
        primaryType: "Deposit",
        message: {
          user: getAddress(address),
          assets: amt,
          nonce,
          deadline,
        },
      });

      toast("Submitting via relayer…");
      const res = await fetch("/api/snapzo/relay-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: getAddress(address),
          assets: amt.toString(),
          nonce: nonce.toString(),
          deadline: deadline.toString(),
          signature,
        }),
      });
      const json = (await res.json()) as { hash?: `0x${string}`; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? `Relay failed (${res.status})`);
      }
      if (!json.hash) {
        throw new Error("Relay returned no tx hash");
      }
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: json.hash });
      }
      toast(txToast(json.hash, "Deposit complete"));
      setHubDepositIn("");
      await refetchHub();
    } catch (e) {
      toast(formatTxError(e), "error");
    } finally {
      setBusy(false);
    }
  }, [
    address,
    hubDepositParsed,
    hubNonce,
    isConnected,
    musdAllowHub,
    publicClient,
    refetchHub,
    signTypedDataAsync,
    toast,
    wrongChain,
    writeContractAsync,
  ]);

  const runHubWithdraw = useCallback(async () => {
    if (!isConnected || !address || wrongChain) {
      return;
    }
    const amt = hubWithdrawParsed;
    if (!amt || amt <= ZERO) {
      toast("Enter a SNAP amount.", "error");
      return;
    }
    if (snapBal.data !== undefined && amt > snapBal.data) {
      toast("Amount exceeds your SNAP balance.", "error");
      return;
    }
    setBusy(true);
    try {
      const nonceRes = await hubNonce.refetch();
      const nonce = nonceRes.data ?? ZERO;
      const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SECS;

      toast("Sign withdraw intent in your wallet…");
      const signature = await signTypedDataAsync({
        domain: snapZoHubDomain(SNAPZO_HUB_ADDRESS),
        types: snapZoWithdrawTypes,
        primaryType: "Withdraw",
        message: {
          user: getAddress(address),
          snapAmount: amt,
          nonce,
          deadline,
        },
      });

      toast("Submitting via relayer…");
      const res = await fetch("/api/snapzo/relay-withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: getAddress(address),
          snapAmount: amt.toString(),
          nonce: nonce.toString(),
          deadline: deadline.toString(),
          signature,
        }),
      });
      const json = (await res.json()) as { hash?: `0x${string}`; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? `Relay failed (${res.status})`);
      }
      if (!json.hash) {
        throw new Error("Relay returned no tx hash");
      }
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: json.hash });
      }
      toast(txToast(json.hash, "Withdraw complete"));
      setHubWithdrawIn("");
      await refetchHub();
    } catch (e) {
      toast(formatTxError(e), "error");
    } finally {
      setBusy(false);
    }
  }, [
    address,
    hubNonce,
    hubWithdrawParsed,
    isConnected,
    publicClient,
    refetchHub,
    signTypedDataAsync,
    snapBal.data,
    toast,
    wrongChain,
  ]);

  const ensureReady = useCallback(() => {
    if (!isConnected) {
      openConnectModal?.();
      return false;
    }
    if (wrongChain) {
      switchChain?.({ chainId: mezoTestnet.id });
      return false;
    }
    return true;
  }, [isConnected, openConnectModal, switchChain, wrongChain]);

  const amountIn = hubMode === "deposit" ? hubDepositIn : hubWithdrawIn;
  const setAmountIn = hubMode === "deposit" ? setHubDepositIn : setHubWithdrawIn;
  const onMax = () => {
    if (hubMode === "deposit") {
      if (musdBal.data !== undefined) {
        setHubDepositIn(formatUnits(musdBal.data, MUSD_DECIMALS));
      }
    } else if (snapBal.data !== undefined) {
      setHubWithdrawIn(formatUnits(snapBal.data, SNAP_DECIMALS));
    }
  };

  const primaryLabel =
    hubMode === "deposit" ? "Sign & relay deposit" : "Sign & relay withdraw";
  const primaryAction = hubMode === "deposit" ? runHubDeposit : runHubWithdraw;

  const fieldShell =
    "flex min-h-[52px] items-stretch gap-2 rounded-2xl border border-white/[0.12] bg-zinc-950/70 pl-4 pr-1.5 shadow-inner outline-none ring-offset-2 ring-offset-[#070b12] transition focus-within:border-emerald-500/45 focus-within:ring-2 focus-within:ring-emerald-500/25";
  const inputClass =
    "min-w-0 flex-1 border-0 bg-transparent py-3 text-right font-mono text-lg tabular-nums tracking-tight text-white outline-none placeholder:text-zinc-600";

  if (!configured) {
    return null;
  }

  const explorer = mezoTestnet.blockExplorers.default.url;

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-gradient-to-b from-zinc-900/90 to-black/80 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 gap-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-white">SnapZo pool</h2>
            <span className="inline-flex items-center rounded-md border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase leading-tight tracking-wide text-emerald-200/95">
              Gasless
            </span>
            <HelpPopover label="How the pool works" size="sm">
              <p>
                <strong>Deposit.</strong> MUSD goes to the Mezo vault + gauge; SNAP mints 1:1 with
                the sMUSD wei credited to the hub on that deposit (vault rate applies).
              </p>
              <p>
                <strong>Withdraw.</strong> Burning SNAP returns MUSD from the hub position. Gauge
                MEZO is indexed to SNAP; you receive MEZO on the same withdrawal, and the hub fee
                applies only to that MEZO portion.
              </p>
            </HelpPopover>
          </div>
          <p className="mt-1.5 text-sm text-zinc-400">
            {hubMode === "deposit" ? (
              <>
                Send{" "}
                <span className="inline-flex items-center gap-0.5 align-middle font-medium text-zinc-200">
                  <MusdInlineIcon className="shrink-0 rounded-full object-cover" />
                  MUSD
                </span>{" "}
                → receive{" "}
                <span className="inline-flex items-center gap-0 whitespace-nowrap align-middle">
                  <SnapInlineIcon decorative />
                  {"SNAP"}
                </span>
                .
              </>
            ) : (
              <>
                Burn{" "}
                <span className="inline-flex items-center gap-0 align-middle">
                  <SnapInlineIcon decorative />
                  {"SNAP"}
                </span>{" "}
                →{" "}
                <span className="inline-flex items-center gap-0.5 align-middle font-medium text-zinc-200">
                  <MusdInlineIcon className="shrink-0 rounded-full object-cover" />
                  MUSD
                </span>{" "}
                + MEZO (fee on MEZO only).
              </>
            )}
          </p>
        </div>
        {isConnected && !wrongChain ? (
          <button
            type="button"
            onClick={() => void addSnapToWallet()}
            className="shrink-0 self-start rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-100 sm:self-auto"
          >
            <span className="inline-flex items-center gap-0">
              <SnapInlineIcon decorative />
              {"SNAP"}
            </span>
          </button>
        ) : null}
      </div>

      {wrongChain ? (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-100/90">
            Switch to Mezo testnet to use this pool.
          </p>
          <button
            type="button"
            className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
            onClick={() => switchChain?.({ chainId: mezoTestnet.id })}
          >
            Switch network
          </button>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-2 min-[380px]:grid-cols-3 sm:gap-3">
        <div className="rounded-xl border border-white/[0.08] bg-black/35 px-3 py-3 sm:px-4">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            <MusdInlineIcon className="shrink-0 rounded-full object-cover" />
            MUSD
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-white sm:text-base">
            {isConnected && !wrongChain
              ? formatUnitsMax2dp(musdBal.data, MUSD_DECIMALS)
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-black/35 px-3 py-3 sm:px-4">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            <SnapInlineIcon decorative />
            {"SNAP"}
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-emerald-200/95 sm:text-base">
            {isConnected && !wrongChain
              ? formatUnitsMax2dp(snapBal.data, SNAP_DECIMALS)
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-black/35 px-3 py-3 sm:px-4">
          <div className="flex items-center justify-between gap-1">
            <p className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              <MezoInlineIcon decorative />
              MEZO
            </p>
            <HelpPopover label="MEZO rewards" size="sm">
              <p>
                Gauge emissions are claimed into the hub and indexed to SNAP. This number is what
                you could claim on a full exit right now (before the withdraw fee on MEZO).
              </p>
            </HelpPopover>
          </div>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-sky-200/95 sm:text-base">
            {isConnected && !wrongChain
              ? hubWithdrawPositionPending || isDataStale
                ? "…" 
                : formatUnitsMax2dp(userTotalMezoWei, MUSD_DECIMALS)
              : "—"}
          </p>
        </div>
      </div>

      <div
        className="mb-4 flex rounded-xl border border-white/[0.1] bg-black/45 p-1"
        role="tablist"
        aria-label="Deposit or withdraw"
      >
        <button
          type="button"
          role="tab"
          aria-selected={hubMode === "deposit"}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition ${
            hubMode === "deposit"
              ? "bg-emerald-500/20 text-emerald-100 shadow-sm"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
          onClick={() => setHubMode("deposit")}
        >
          <MusdInlineIcon className="shrink-0 rounded-full object-cover opacity-90" />
          Deposit
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={hubMode === "withdraw"}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
            hubMode === "withdraw"
              ? "bg-amber-500/20 text-amber-100 shadow-sm"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
          onClick={() => setHubMode("withdraw")}
        >
          Withdraw
        </button>
      </div>

      <div className={fieldShell}>
        <input
          type="text"
          inputMode="decimal"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
          placeholder="0.00"
          className={inputClass}
          aria-label={hubMode === "deposit" ? "MUSD amount" : "SNAP amount"}
        />
        <button
          type="button"
          className="my-2 shrink-0 self-center rounded-lg border border-sky-500/35 bg-sky-500/[0.12] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-200 transition hover:bg-sky-500/25"
          onClick={onMax}
        >
          Max
        </button>
      </div>

      <div className="mt-3 rounded-2xl border border-white/[0.08] bg-black/40 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
            {hubMode === "deposit" ? "Deposit" : "Withdraw"} preview
          </span>
          <HelpPopover label="How previews are calculated" size="sm">
            <p>
              <strong>Deposit — SNAP.</strong> From the vault{" "}
              <span className="font-mono text-zinc-200">convertToShares</span> for your MUSD input;
              the hub mints the same sMUSD wei as SNAP.
            </p>
            <p>
              <strong>Withdraw — MUSD.</strong> Hub sMUSD freed = floor(your SNAP × hub sMUSD ÷ SNAP
              supply). Shown as MUSD unless a vault marginal quote disagrees by more than 50%
              (testnet reads are noisy).
            </p>
            <p>
              <strong>Withdraw — <MezoInlineIcon decorative /> MEZO.</strong> Pro-rata from your current{" "}
              <span className="font-mono text-zinc-200">earned()</span>. The tx also claims the
              gauge, so <MezoInlineIcon decorative /> MEZO can be slightly higher if new rewards land in the same block.
            </p>
          </HelpPopover>
        </div>

        {hubMode === "deposit" ? (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500">Minimum 1 MUSD · approve once, then sign</p>
            {depositPreviewSnap.isSuccess &&
            depositPreviewSnap.data !== undefined &&
            depositPreviewSnap.data > ZERO ? (
              <div className="flex flex-col gap-1 rounded-xl bg-white/[0.04] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="inline-flex items-center gap-0 text-xs text-zinc-500">
                  <SnapInlineIcon decorative />
                  {"SNAP (approx.)"}
                </span>
                <span className="font-mono text-sm font-semibold text-zinc-100">
                  ~{formatUnits(depositPreviewSnap.data, SNAP_DECIMALS)}
                </span>
              </div>
            ) : null}
            {depositPreviewSnap.isError ? (
              <p className="text-xs font-medium text-amber-200/85">Mint preview unavailable.</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-xs text-zinc-500">No approve · sign only</p>
            {withdrawPoolReady ? (
              withdrawToFreeSharesWei === undefined ? (
                <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-100/90">
                  Too small — hub share rounds to zero. Try more SNAP.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-col gap-1 rounded-xl bg-white/[0.04] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <MusdInlineIcon className="shrink-0 rounded-full object-cover" />
                      MUSD (approx.)
                    </span>
                    <div className="text-right">
                      <span className="font-mono text-sm font-semibold text-white">
                        ~{formatUnitsMax2dp(withdrawMusdDisplay.musdWei, MUSD_DECIMALS)}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-normal text-zinc-500 sm:mt-0 sm:ml-2 sm:inline">
                        {withdrawMusdDisplay.basis === "vault-marginal"
                          ? "marginal quote"
                          : "share parity"}
                      </span>
                    </div>
                  </div>
                  {withdrawMezoPreview !== undefined ? (
                    <div className="flex flex-col gap-1 rounded-xl bg-sky-500/[0.08] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-200/85">
                        <MezoInlineIcon decorative />
                        MEZO net (approx.)
                      </span>
                      <div className="text-right">
                        <span className="font-mono text-sm font-semibold text-sky-50">
                          ~{formatUnitsMax2dp(withdrawMezoPreview.netWei, MUSD_DECIMALS)}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-sky-300/75 sm:mt-0 sm:ml-2 sm:inline">
                          fee {formatUnitsMax2dp(withdrawMezoPreview.feeWei, MUSD_DECIMALS)} on{" "}
                          {formatUnitsMax2dp(withdrawMezoPreview.grossWei, MUSD_DECIMALS)} gross
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            ) : hubWithdrawParsed !== undefined &&
              hubWithdrawParsed > ZERO &&
              snapBal.data !== undefined &&
              snapBal.data > ZERO &&
              hubWithdrawParsed <= snapBal.data &&
              withdrawMezoPreview !== undefined ? (
                <div className="space-y-1.5">
                  <div className="flex flex-col gap-1 rounded-xl bg-sky-500/[0.08] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-200/85">
                      <MezoInlineIcon decorative />
                      MEZO net (approx.)
                    </span>
                    <div className="text-right">
                      <span className="font-mono text-sm font-semibold text-sky-50">
                        ~{formatUnitsMax2dp(withdrawMezoPreview.netWei, MUSD_DECIMALS)}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-sky-300/75 sm:mt-0 sm:ml-2 sm:inline">
                        fee {formatUnitsMax2dp(withdrawMezoPreview.feeWei, MUSD_DECIMALS)} on{" "}
                        {formatUnitsMax2dp(withdrawMezoPreview.grossWei, MUSD_DECIMALS)} gross
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-600">MUSD line appears when hub totals load.</p>
                </div>
              ) : null}
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={!canAct && isConnected && !wrongChain}
        onClick={() => {
          if (!ensureReady()) {
            return;
          }
          void primaryAction();
        }}
        className={`mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition disabled:opacity-40 ${
          hubMode === "deposit"
            ? "bg-emerald-600 hover:bg-emerald-500"
            : "border border-amber-400/35 bg-amber-600/90 hover:bg-amber-500"
        }`}
      >
        {(busy || isWritePending || isSignPending) && isConnected && !wrongChain ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : null}
        {!isConnected
          ? "Connect wallet"
          : wrongChain
            ? "Wrong network"
            : primaryLabel}
      </button>

      <a
        href={`${explorer}/address/${SNAPZO_HUB_ADDRESS}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block text-center text-[11px] font-medium text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline"
      >
        View hub contract on explorer
      </a>
    </section>
  );
}
