"use client";

import { useMemo, useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Loader2 } from "lucide-react";
import { formatUnits, isAddress, parseUnits } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
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

function parseProofInput(raw: string): `0x${string}`[] | undefined {
  const parts = raw
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];
  const out: `0x${string}`[] = [];
  for (const p of parts) {
    const ok = /^0x[0-9a-fA-F]{64}$/.test(p);
    if (!ok) return undefined;
    out.push(p as `0x${string}`);
  }
  return out;
}

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
  const [cycleIn, setCycleIn] = useState("");
  const [amountIn, setAmountIn] = useState("");
  const [proofIn, setProofIn] = useState("");

  const wrongChain = isConnected && chainId !== mezoTestnet.id;

  const cycle = useMemo(() => {
    const t = cycleIn.trim();
    if (!/^\d+$/.test(t)) return undefined;
    return BigInt(t);
  }, [cycleIn]);

  const amountWei = useMemo(() => {
    const t = amountIn.trim().replace(",", ".");
    if (!t) return undefined;
    try {
      return parseUnits(t, MUSD_DECIMALS);
    } catch {
      return undefined;
    }
  }, [amountIn]);

  const proof = useMemo(() => parseProofInput(proofIn), [proofIn]);

  const reads = useReadContracts({
    contracts: [
      {
        chainId: mezoTestnet.id,
        address: SNAPZO_REWARDS_ADDRESS,
        abi: snapZoRewardsAbi,
        functionName: "rewardToken",
      },
      {
        chainId: mezoTestnet.id,
        address: SNAPZO_REWARDS_ADDRESS,
        abi: snapZoRewardsAbi,
        functionName: "roots",
        args: cycle !== undefined ? [cycle] : undefined,
      },
      {
        chainId: mezoTestnet.id,
        address: SNAPZO_REWARDS_ADDRESS,
        abi: snapZoRewardsAbi,
        functionName: "hasClaimed",
        args: cycle !== undefined && address ? [cycle, address] : undefined,
      },
    ],
    query: {
      enabled: rewardsOk,
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const rewardToken =
    reads.data?.[0]?.status === "success" ? reads.data[0].result : undefined;
  const rootForCycle =
    reads.data?.[1]?.status === "success" ? reads.data[1].result : undefined;
  const hasClaimed =
    reads.data?.[2]?.status === "success" ? reads.data[2].result : undefined;

  const rewardBalance = useReadContract({
    chainId: mezoTestnet.id,
    address: (rewardToken ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: rewardsOk && rewardToken && address ? [address] : undefined,
    query: { enabled: Boolean(rewardsOk && rewardToken && address) },
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
    if (cycle === undefined) {
      toast("Enter a valid cycle number.", "error");
      return;
    }
    if (amountWei === undefined || amountWei <= BigInt(0)) {
      toast("Enter a valid claim amount.", "error");
      return;
    }
    if (!proof || proof.length === 0) {
      toast("Paste a valid merkle proof (one or more bytes32 values).", "error");
      return;
    }
    if (rootForCycle === undefined || /^0x0{64}$/i.test(rootForCycle)) {
      toast("No root is set for this cycle on SnapZoRewards.", "error");
      return;
    }
    setBusy(true);
    try {
      const hash = await writeContractAsync({
        chainId: mezoTestnet.id,
        address: SNAPZO_REWARDS_ADDRESS,
        abi: snapZoRewardsAbi,
        functionName: "claim",
        args: [cycle, amountWei, proof],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await Promise.all([reads.refetch(), rewardBalance.refetch()]);
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

  const input =
    "w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 font-mono text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-500/40";
  const btn =
    "inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40";

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-gradient-to-b from-zinc-900/85 to-black/80 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-white">
          Creator rewards
        </h2>
        <button
          type="button"
          className="rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:bg-white/10"
          onClick={() => void Promise.all([reads.refetch(), rewardBalance.refetch()])}
        >
          Refresh
        </button>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-zinc-500">
        Claim your Merkle-assigned <MezoInlineIcon decorative /> MEZO from{" "}
        <span className="font-mono text-zinc-400">SnapZoRewards</span>. Ask your
        backend/ops for cycle, amount, and proof values.
      </p>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
            Cycle status
          </p>
          <p className="font-mono text-sm font-semibold text-zinc-100">
            {cycle === undefined
              ? "Enter cycle"
              : hasClaimed === undefined
                ? "…"
                : hasClaimed
                  ? "Already claimed"
                  : "Claimable (if proof valid)"}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <input
          className={input}
          inputMode="numeric"
          placeholder="Cycle (e.g. 1)"
          value={cycleIn}
          onChange={(e) => setCycleIn(e.target.value)}
        />
        <input
          className={input}
          inputMode="decimal"
          placeholder="Amount in MEZO (e.g. 12.34)"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
        />
        <textarea
          className={`${input} min-h-[84px] text-xs`}
          placeholder="Merkle proof bytes32 list (comma or newline separated, each 0x + 64 hex chars)"
          value={proofIn}
          onChange={(e) => setProofIn(e.target.value)}
        />
      </div>
      <button
        type="button"
        className={`${btn} mt-3`}
        disabled={busy || isWritePending}
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

