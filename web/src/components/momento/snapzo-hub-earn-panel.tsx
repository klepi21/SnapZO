"use client";

import { useCallback, useMemo, useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Loader2 } from "lucide-react";
import {
  UserRejectedRequestError,
  formatUnits,
  getAddress,
  maxUint256,
  parseUnits,
} from "viem";
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
import { MUSD_WEI_PER_SNAP_BASE } from "@/lib/snapzo/musd-snap-quote";
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

const ZERO = BigInt(0);
const MIN_DEPOSIT_WEI = BigInt("1000000000000000000");
const DEADLINE_SECS = BigInt(3600);

type HubMode = "deposit" | "withdraw";

function formatUnitsMax2dp(value: bigint | undefined, decimals: number): string {
  if (value === undefined) {
    return "…";
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

export function SnapZoHubEarnPanel() {
  const configured = isSnapZoHubConfigured();
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

  const hubDepositParsed = useMemo(() => parsedMusdAmount(hubDepositIn), [hubDepositIn]);
  const hubWithdrawParsed = useMemo(() => parsedSnapAmount(hubWithdrawIn), [hubWithdrawIn]);

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
      enabled: configured,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  });

  const hubTa =
    hubNav.data?.[0]?.status === "success" ? hubNav.data[0].result : undefined;
  const hubTs =
    hubNav.data?.[1]?.status === "success" ? hubNav.data[1].result : undefined;

  const depositPreviewSnap = useMemo(() => {
    const amt = hubDepositParsed;
    if (!amt || amt <= ZERO || hubTa === undefined || hubTs === undefined) {
      return undefined;
    }
    if (hubTa <= ZERO) {
      return undefined;
    }
    if (hubTs === ZERO) {
      return amt / MUSD_WEI_PER_SNAP_BASE;
    }
    return (amt * hubTs) / hubTa;
  }, [hubDepositParsed, hubTa, hubTs]);

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
    await musdAllowHub.refetch();
    await hubNav.refetch();
  }, [hubNav, hubNonce, musdAllowHub, musdBal, snapBal]);

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
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 gap-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              SnapZo pool
            </h2>
            <span className="inline-flex max-w-[11rem] items-center rounded-md border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase leading-tight tracking-wide text-emerald-200/95 sm:max-w-none">
              Gasless transactions
            </span>
          </div>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-zinc-400">
            {hubMode === "deposit" ? (
              <>
                Send{" "}
                <span className="inline-flex items-center gap-0.5 align-middle">
                  <MusdInlineIcon size={13} className="shrink-0 rounded-full object-cover" />
                  <span className="font-medium text-zinc-300">MUSD</span>
                </span>{" "}
                to the hub. You get SNAP (6 decimals) representing your share — larger whole
                numbers than 18-decimal shares.
              </>
            ) : (
              <>
                Burn SNAP.{" "}
                <span className="inline-flex items-center gap-0.5 align-middle">
                  <MusdInlineIcon size={13} className="shrink-0 rounded-full object-cover" />
                  <span className="font-medium text-zinc-300">MUSD</span>
                </span>{" "}
                returns to your wallet after the relayer runs the tx.
              </>
            )}
          </p>
        </div>
        {isConnected && !wrongChain ? (
          <button
            type="button"
            onClick={() => void addSnapToWallet()}
            className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-100"
          >
            Add SNAP to wallet
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

      <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3">
        <div className="rounded-xl border border-white/[0.08] bg-black/35 px-3 py-2.5 sm:px-4">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            <MusdInlineIcon size={14} className="shrink-0 rounded-full object-cover" />
            MUSD
          </p>
          <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-white">
            {isConnected && !wrongChain
              ? formatUnitsMax2dp(musdBal.data, MUSD_DECIMALS)
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-black/35 px-3 py-2.5 sm:px-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            SNAP
          </p>
          <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-emerald-200/95">
            {isConnected && !wrongChain
              ? formatUnitsMax2dp(snapBal.data, SNAP_DECIMALS)
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
          <MusdInlineIcon size={15} className="shrink-0 rounded-full object-cover opacity-90" />
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

      <p className="mt-2 flex items-start gap-1.5 text-xs text-zinc-500">
        {hubMode === "deposit" ? (
          <>
            <MusdInlineIcon size={14} className="mt-0.5 shrink-0 rounded-full object-cover opacity-90" />
            <span>
              Minimum 1 MUSD. First time: approve the hub, then sign the deposit message.
              {depositPreviewSnap !== undefined ? (
                <>
                  {" "}
                  <span className="font-medium text-zinc-400">
                    ~{formatUnits(depositPreviewSnap, SNAP_DECIMALS)} SNAP minted (floor, same as
                    hub).
                  </span>
                </>
              ) : null}
            </span>
          </>
        ) : (
          "Amount in SNAP (6 decimals). No approve needed — only your signature."
        )}
      </p>

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
