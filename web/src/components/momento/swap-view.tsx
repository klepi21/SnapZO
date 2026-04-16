"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ArrowDown, ArrowLeft, Loader2 } from "lucide-react";
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
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { MusdInlineIcon } from "@/components/icons/musd-inline-icon";
import { useSnapzoToast } from "@/components/providers/snapzo-toast-provider";
import { mezoTestnet } from "@/lib/chains/mezo-testnet";
import {
  MEZO_BTC_ERC20,
  MEZO_DEX_TOKEN_DECIMALS,
  MEZO_SWAP_ROUTER,
  erc20AllowanceAbi,
  erc20ApproveAbi,
  mezoSwapRouterAbi,
  swapRouteBtcToMusd,
  swapRouteMusdToBtc,
} from "@/lib/constants/mezo-dex";
import {
  erc20BalanceAbi,
  MUSD_ADDRESS_MEZO_TESTNET,
} from "@/lib/constants/musd";

type Direction = "btc-musd" | "musd-btc";

const ZERO_WEI = BigInt(0);

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

export function SwapView() {
  const toast = useSnapzoToast();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const publicClient = usePublicClient({ chainId: mezoTestnet.id });

  const [direction, setDirection] = useState<Direction>("btc-musd");
  const [amountIn, setAmountIn] = useState("");
  const [busy, setBusy] = useState(false);

  const wrongChain = isConnected && chainId !== mezoTestnet.id;

  const tokenIn =
    direction === "btc-musd" ? MEZO_BTC_ERC20 : MUSD_ADDRESS_MEZO_TESTNET;

  const path = useMemo(
    () =>
      direction === "btc-musd"
        ? swapRouteBtcToMusd().map((r) => ({
            ...r,
            from: getAddress(r.from),
            to: getAddress(r.to),
            factory: getAddress(r.factory),
          }))
        : swapRouteMusdToBtc().map((r) => ({
            ...r,
            from: getAddress(r.from),
            to: getAddress(r.to),
            factory: getAddress(r.factory),
          })),
    [direction],
  );

  const parsedIn = useMemo(() => {
    const t = amountIn.trim().replace(",", ".");
    if (!t) {
      return undefined;
    }
    try {
      return parseUnits(t, MEZO_DEX_TOKEN_DECIMALS);
    } catch {
      return undefined;
    }
  }, [amountIn]);

  const btcBal = useReadContract({
    chainId: mezoTestnet.id,
    address: MEZO_BTC_ERC20,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(isConnected && address && chainId === mezoTestnet.id),
    },
  });

  const musdBal = useReadContract({
    chainId: mezoTestnet.id,
    address: MUSD_ADDRESS_MEZO_TESTNET,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(isConnected && address && chainId === mezoTestnet.id),
    },
  });

  const allowance = useReadContract({
    chainId: mezoTestnet.id,
    address: tokenIn,
    abi: erc20AllowanceAbi,
    functionName: "allowance",
    args:
      address && parsedIn !== undefined
        ? [address, MEZO_SWAP_ROUTER]
        : undefined,
    query: {
      enabled: Boolean(
        isConnected &&
          address &&
          chainId === mezoTestnet.id &&
          parsedIn !== undefined &&
          parsedIn > ZERO_WEI,
      ),
    },
  });

  const amountsOut = useReadContract({
    chainId: mezoTestnet.id,
    address: MEZO_SWAP_ROUTER,
    abi: mezoSwapRouterAbi,
    functionName: "getAmountsOut",
    args:
      parsedIn !== undefined && parsedIn > ZERO_WEI
        ? [parsedIn, path]
        : undefined,
    query: {
      enabled: Boolean(
        chainId === mezoTestnet.id &&
          parsedIn !== undefined &&
          parsedIn > ZERO_WEI,
      ),
      staleTime: 12_000,
    },
  });

  const expectedOut = useMemo(() => {
    const arr = amountsOut.data;
    if (!arr?.length) {
      return undefined;
    }
    return arr[arr.length - 1];
  }, [amountsOut.data]);

  const quoteError = amountsOut.error;

  const runSwap = useCallback(async () => {
    if (!isConnected || !address) {
      openConnectModal?.();
      return;
    }
    if (wrongChain) {
      if (switchChain) {
        await switchChain({ chainId: mezoTestnet.id });
        toast("Switch to Mezo Testnet, then try again.", "error");
      } else {
        toast("Switch to Mezo Testnet (31611) in your wallet.", "error");
      }
      return;
    }
    if (!parsedIn || parsedIn <= ZERO_WEI) {
      toast("Enter an amount.", "error");
      return;
    }

    setBusy(true);
    try {
      const need =
        allowance.data !== undefined ? parsedIn > allowance.data : true;
      if (need) {
        toast("Approve router in your wallet…");
        const approveHash = await writeContractAsync({
          chainId: mezoTestnet.id,
          address: tokenIn,
          abi: erc20ApproveAbi,
          functionName: "approve",
          args: [MEZO_SWAP_ROUTER, maxUint256],
        });
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
        await allowance.refetch();
        toast(`Approved · ${approveHash.slice(0, 10)}…`);
      }

      toast("Confirm swap in your wallet…");
      const hash = await writeContractAsync({
        chainId: mezoTestnet.id,
        address: MEZO_SWAP_ROUTER,
        abi: mezoSwapRouterAbi,
        functionName: "swapExactTokensForTokens",
        args: [
          parsedIn,
          ZERO_WEI,
          path,
          getAddress(address),
          BigInt(Math.floor(Date.now() / 1000) + 1200),
        ],
      });
      const explorerUrl = `${mezoTestnet.blockExplorers.default.url}/tx/${hash}`;
      toast({
        title: "Swap submitted",
        subtitle: "Track confirmation on the explorer.",
        link: {
          href: explorerUrl,
          label: `View transaction · ${hash.slice(0, 8)}…${hash.slice(-6)}`,
        },
      });
      setAmountIn("");
      void btcBal.refetch();
      void musdBal.refetch();
      void allowance.refetch();
    } catch (e) {
      toast(formatTxError(e), "error");
    } finally {
      setBusy(false);
    }
  }, [
    address,
    allowance,
    btcBal,
    isConnected,
    musdBal,
    openConnectModal,
    parsedIn,
    path,
    publicClient,
    switchChain,
    toast,
    tokenIn,
    wrongChain,
    writeContractAsync,
  ]);

  const inBalance =
    direction === "btc-musd" ? btcBal.data : musdBal.data;
  const inBalanceFmt =
    inBalance !== undefined
      ? formatUnits(inBalance, MEZO_DEX_TOKEN_DECIMALS)
      : null;

  const quoteLoading =
    parsedIn !== undefined &&
    parsedIn > ZERO_WEI &&
    chainId === mezoTestnet.id &&
    (amountsOut.isPending || amountsOut.isFetching);

  const outPreview =
    expectedOut !== undefined
      ? formatUnits(expectedOut, MEZO_DEX_TOKEN_DECIMALS)
      : quoteError
        ? "—"
        : quoteLoading
          ? "…"
          : parsedIn && parsedIn > ZERO_WEI
            ? "—"
            : "0";

  const canSubmit =
    isConnected &&
    !wrongChain &&
    parsedIn !== undefined &&
    parsedIn > ZERO_WEI &&
    !busy &&
    !isWritePending;

  return (
    <main className="pb-28 pt-5">
      <div className="mb-4 flex items-center gap-2 px-4">
        <Link
          href="/feed"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-black/25 text-white backdrop-blur-md transition hover:bg-white/10"
          aria-label="Back to feed"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-white">
            Swap
          </h1>
          <p className="text-xs font-normal text-zinc-500">
            Router on Mezo testnet (BTC token ↔ MUSD)
          </p>
        </div>
      </div>

      <div className="mx-4 overflow-hidden rounded-[28px] border border-white/[0.1] bg-white/[0.045] shadow-[0_20px_56px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
        <div className="border-b border-white/[0.08] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Direction
          </p>
          <div className="mt-2 flex rounded-2xl border border-white/10 bg-black/25 p-1">
            <button
              type="button"
              onClick={() => setDirection("btc-musd")}
              className={`flex-1 rounded-xl py-2.5 text-xs font-semibold transition ${
                direction === "btc-musd"
                  ? "bg-indigo-500/35 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              BTC → MUSD
            </button>
            <button
              type="button"
              onClick={() => setDirection("musd-btc")}
              className={`flex-1 rounded-xl py-2.5 text-xs font-semibold transition ${
                direction === "musd-btc"
                  ? "bg-indigo-500/35 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              MUSD → BTC
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                You pay
              </span>
              {inBalanceFmt !== null ? (
                <button
                  type="button"
                  className="text-[11px] font-medium text-[#0095f6] hover:underline"
                  onClick={() => setAmountIn(inBalanceFmt)}
                >
                  Max
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-3">
              <span className="text-xs font-medium text-zinc-400">
                {direction === "btc-musd" ? "BTC" : "MUSD"}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                placeholder="0.0"
                className="min-w-0 flex-1 border-0 bg-transparent text-right text-lg font-semibold tabular-nums text-white outline-none placeholder:text-zinc-600"
              />
            </div>
            {inBalanceFmt !== null ? (
              <p className="mt-1 text-right text-[11px] text-zinc-600">
                Balance {inBalanceFmt.slice(0, 14)}
                {inBalanceFmt.length > 14 ? "…" : ""}
              </p>
            ) : null}
          </div>

          <div className="flex justify-center py-0.5">
            <span className="rounded-full border border-white/10 bg-zinc-900/80 p-2 text-zinc-500">
              <ArrowDown className="h-4 w-4" strokeWidth={1.5} />
            </span>
          </div>

          <div>
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              You receive (estimate)
            </span>
            <div className="mt-2 flex items-center justify-end gap-2 rounded-2xl border border-white/10 bg-zinc-950/50 px-3 py-3">
              <span className="text-lg font-semibold tabular-nums text-white">
                {outPreview}
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-zinc-400">
                {direction === "btc-musd" ? (
                  <>
                    <MusdInlineIcon size={18} />
                    <span className="sr-only">MUSD</span>
                  </>
                ) : (
                  "BTC"
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.08] bg-black/15 px-4 py-4">
          <p className="mb-3 text-center text-[11px] leading-relaxed text-amber-200/90">
            Demo: min received is set to 0 (no slippage protection). Use small
            amounts on testnet.
          </p>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void runSwap()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-400/40 bg-gradient-to-br from-indigo-500/35 to-sky-500/25 py-3.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(99,102,241,0.18)] transition hover:border-indigo-300/55 hover:from-indigo-500/45 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy || isWritePending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Working…
              </>
            ) : (
              "Swap"
            )}
          </button>
          <a
            className="mt-3 block text-center text-[11px] font-medium text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
            href="https://explorer.test.mezo.org/tx/0x22d0d5083ca9a7577c22174d0b3ebc0a133935fc9846a35c6a7e5ab27e606c8b"
            target="_blank"
            rel="noreferrer"
          >
            Reference swap tx (same router path)
          </a>
        </div>
      </div>

      <p className="mx-4 mt-4 text-center text-[11px] leading-relaxed text-zinc-600">
        Uses <span className="font-mono text-zinc-500">{MEZO_SWAP_ROUTER}</span>
        . You need the router ERC-20 BTC token (18 decimals), not native gas
        only — fund that token from the faucet / bridge Mezo documents describe.
      </p>
    </main>
  );
}
