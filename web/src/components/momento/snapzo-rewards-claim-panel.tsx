"use client";

import { useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Loader2 } from "lucide-react";
import { formatUnits } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";

import { MezoInlineIcon } from "@/components/icons/mezo-inline-icon";
import { useSnapzoToast } from "@/components/providers/snapzo-toast-provider";
import { mezoTestnet } from "@/lib/chains/mezo-testnet";
import { erc20BalanceAbi, MUSD_DECIMALS } from "@/lib/constants/musd";
import { snapZoRewardsAbi } from "@/lib/constants/snapzo-rewards-abi";
import {
  isSnapZoRewardsConfigured,
  SNAPZO_REWARDS_ADDRESS,
} from "@/lib/constants/snapzo-hub";

function formatAmount(v: bigint | undefined): string {
  if (v === undefined) return "…";
  const s = formatUnits(v, MUSD_DECIMALS);
  const [i, f = ""] = s.split(".");
  const trimmed = f.slice(0, 4).replace(/0+$/, "");
  return trimmed ? `${i}.${trimmed}` : i;
}

export function SnapZoRewardsClaimPanel() {
  const rewardsOk = isSnapZoRewardsConfigured();
  const toast = useSnapzoToast();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: mezoTestnet.id });
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  const [busy, setBusy] = useState(false);

  const wrongChain = isConnected && chainId !== mezoTestnet.id;

  const rewardToken = useReadContract({
    chainId: mezoTestnet.id,
    address: SNAPZO_REWARDS_ADDRESS,
    abi: snapZoRewardsAbi,
    functionName: "rewardToken",
    query: { enabled: rewardsOk },
  });

  const claimable = useReadContract({
    chainId: mezoTestnet.id,
    address: SNAPZO_REWARDS_ADDRESS,
    abi: snapZoRewardsAbi,
    functionName: "claimable",
    args: address ? [address] : undefined,
    query: { enabled: rewardsOk && Boolean(address), staleTime: 0, refetchOnWindowFocus: true },
  });

  const claimed = useReadContract({
    chainId: mezoTestnet.id,
    address: SNAPZO_REWARDS_ADDRESS,
    abi: snapZoRewardsAbi,
    functionName: "claimed",
    args: address ? [address] : undefined,
    query: { enabled: rewardsOk && Boolean(address), staleTime: 0, refetchOnWindowFocus: true },
  });

  const rewardBalance = useReadContract({
    chainId: mezoTestnet.id,
    address: (rewardToken.data ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: rewardsOk && rewardToken.data && address ? [address] : undefined,
    query: { enabled: Boolean(rewardsOk && rewardToken.data && address) },
  });

  async function onClaim() {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (wrongChain) {
      switchChain?.({ chainId: mezoTestnet.id });
      return;
    }
    if ((claimable.data ?? BigInt(0)) <= BigInt(0)) {
      toast("No claimable rewards yet.", "error");
      return;
    }
    setBusy(true);
    try {
      const hash = await writeContractAsync({
        chainId: mezoTestnet.id,
        address: SNAPZO_REWARDS_ADDRESS,
        abi: snapZoRewardsAbi,
        functionName: "claim",
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await Promise.all([claimable.refetch(), claimed.refetch(), rewardBalance.refetch()]);
      toast("Rewards claimed.");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message.slice(0, 200) : "Claim failed.";
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  if (!rewardsOk) return null;

  const btn =
    "inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40";

  return (
    <section className="snapzo-card-primary p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-white">
          Creator rewards
        </h2>
        <button
          type="button"
          className="rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:bg-white/10"
          onClick={() => void Promise.all([claimable.refetch(), claimed.refetch(), rewardBalance.refetch()])}
        >
          Refresh
        </button>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-zinc-500">
        Claim your indexed <MezoInlineIcon decorative /> MEZO from{" "}
        <span className="font-mono text-zinc-400">SnapZoCreators</span>. No inputs are needed.
      </p>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.08] bg-black/35 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            Your MEZO
          </p>
          <p className="font-mono text-sm font-semibold text-zinc-100">
            {formatAmount(rewardBalance.data)}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-black/35 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            Claimable
          </p>
          <p className="font-mono text-sm font-semibold text-zinc-100">
            {formatAmount(claimable.data)}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-black/35 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            Lifetime claimed
          </p>
          <p className="font-mono text-sm font-semibold text-zinc-100">
            {formatAmount(claimed.data)}
          </p>
        </div>
      </div>
      <button
        type="button"
        className={`${btn} mt-3`}
        disabled={busy || isWritePending || (claimable.data ?? BigInt(0)) <= BigInt(0)}
        onClick={() => void onClaim()}
      >
        {busy || isWritePending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {!isConnected
          ? "Connect wallet"
          : wrongChain
            ? "Wrong network"
            : "Claim rewards"}
      </button>
      <p className="mt-2 text-[10px] text-zinc-600">
        Rewards contract:{" "}
        <span className="font-mono text-zinc-500">{SNAPZO_REWARDS_ADDRESS}</span>
      </p>
    </section>
  );
}

