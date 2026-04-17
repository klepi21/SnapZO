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
import {
  isSnapZoHubConfigured,
  SNAPZO_HUB_ADDRESS,
  SNAPZO_HUB_DEPLOY_BLOCK,
} from "@/lib/constants/snapzo-hub";
import { fetchHubRelayerRows } from "@/lib/snapzo/hub-relayers-from-chain";

const hub = SNAPZO_HUB_ADDRESS;

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
      { chainId: mezoTestnet.id, address: hub, abi: snapZoHubAdminAbi, functionName: "snapToken" },
    ],
    query: {
      enabled: hubOk,
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

  const isOwner =
    Boolean(address && owner) &&
    getAddress(address as `0x${string}`) === getAddress(owner as `0x${string}`);

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
    ],
    query: {
      enabled: Boolean(hubOk && gaugeAddr && rewardTokenAddr && feeReceiver),
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
          isOwner &&
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
    await smusdShareReads.refetch();
    await secondaryReads.refetch();
    await injectAllowance.refetch();
    await queryClient.invalidateQueries({ queryKey: ["snapzoHubRelayers"] });
  }, [hubReads, injectAllowance, queryClient, secondaryReads, smusdShareReads]);

  const runWrite = useCallback(
    async (label: string, fn: () => Promise<`0x${string}`>) => {
      if (!isConnected) {
        openConnectModal?.();
        return;
      }
      if (wrongChain) {
        switchChain?.({ chainId: mezoTestnet.id });
        return;
      }
      if (!isOwner) {
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
      isOwner,
      openConnectModal,
      publicClient,
      refetchAll,
      switchChain,
      toast,
      wrongChain,
    ],
  );

  const onHarvest = () =>
    void runWrite("Harvest complete", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "harvest",
      }),
    );

  const onSyncGaugeRewards = () =>
    void runWrite("Gauge rewards synced", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "syncGaugeRewards",
      }),
    );

  const onRestake = () =>
    void runWrite("Restake complete", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "restake",
      }),
    );

  const onPause = () =>
    void runWrite("Paused", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "pause",
      }),
    );

  const onUnpause = () =>
    void runWrite("Unpaused", () =>
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
    void runWrite("Relayer updated", () =>
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
    void runWrite("Fee config updated", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "setFee",
        args: [b, recv],
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
    void runWrite("Reward token recovered", () =>
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
    void runWrite("Reward token sent to your wallet", async () => {
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
    void runWrite("Swept", () =>
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
    await runWrite("MUSD injected (no SNAP mint)", async () => {
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
    void runWrite("Integrations updated", () =>
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
    void runWrite("Restake routes updated", () =>
      writeContractAsync({
        chainId: mezoTestnet.id,
        address: hub,
        abi: snapZoHubAdminAbi,
        functionName: "setRestakeRoutes",
        args: [h as `0x${string}`],
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

  const canAct = isConnected && !wrongChain && !busy && !isWritePending && isOwner;
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

  if (!hubOk) {
    return (
      <main className="px-4 pb-32 pt-5">
        <p className="text-sm text-zinc-400">SnapZo hub is not configured for this build.</p>
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
            Owner-only controls on the hub proxy. All txs use your wallet (gas in test BTC).
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

      {isConnected && owner && !isOwner ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
          Connected wallet is not the hub owner ({owner.slice(0, 6)}…). Actions are disabled.
        </div>
      ) : null}

      <div className="space-y-4">
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
                <MusdInlineIcon size={12} decorative />
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
              The fee recipient balance is mostly from the <strong><MezoInlineIcon size={14} decorative /> MEZO leg on user withdraws</strong>{" "}
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
            index <MezoInlineIcon size={14} decorative /> MEZO to SNAP holders. <span className="font-mono">recoverRewardToken</span> is only
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
      </div>
    </main>
  );
}
