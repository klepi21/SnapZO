"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  ArrowLeftRight,
  Bitcoin,
  Copy,
  ChevronDown,
  LogOut,
  PiggyBank,
  Shield,
  Wallet,
} from "lucide-react";
import { getAddress } from "viem";
import { useChainId, useDisconnect } from "wagmi";
import { SnapInlineIcon } from "@/components/icons/snap-inline-icon";
import { useMezoBalancesReadout } from "@/hooks/use-mezo-balances-readout";
import { mezoTestnet } from "@/lib/chains/mezo-testnet";
import { MusdInlineIcon } from "@/components/icons/musd-inline-icon";
import { MezoInlineIcon } from "@/components/icons/mezo-inline-icon";
import { MUSD_ADDRESS_MEZO_TESTNET } from "@/lib/constants/musd";
import { isSnapZoHubConfigured } from "@/lib/constants/snapzo-hub";

const ADMIN_WALLET = getAddress("0xE5f3e81f3045865EB140fCC44038433891D0e25f");

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletHeaderMenu() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { disconnect, isPending: isDisconnecting } = useDisconnect();
  const chainId = useChainId();
  const {
    native,
    musdBalance,
    snapBalance,
    mezoBalance,
    btcFormatted,
    musdFormatted,
    snapFormatted,
    mezoFormatted,
  } = useMezoBalancesReadout();

  const unsupported = chainId !== mezoTestnet.id;
  const hubAdmin = isSnapZoHubConfigured();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, close]);

  const copyAddress = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  return (
    <ConnectButton.Custom>
      {({ account, mounted, openConnectModal, openChainModal }) => {
        if (!mounted) {
          return (
            <div
              className="h-9 w-[6.5rem] animate-pulse rounded bg-white/[0.06]"
              aria-hidden
            />
          );
        }

        if (!account) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className="snapzo-pressable rounded-full border border-fuchsia-300/35 bg-fuchsia-500/10 px-3 py-2 text-sm font-semibold tracking-tight text-fuchsia-50 hover:border-fuchsia-200/55 hover:bg-fuchsia-500/18 active:opacity-80"
            >
              Connect
            </button>
          );
        }

        const canSeeAdmin = hubAdmin && getAddress(account.address) === ADMIN_WALLET;

        return (
          <div ref={rootRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="snapzo-pressable snapzo-hit-44 flex h-10 items-center gap-1 rounded-full border border-white/[0.15] bg-white/[0.06] px-2.5 py-1.5 text-left hover:border-fuchsia-300/35 hover:bg-fuchsia-500/10 active:opacity-80"
              aria-expanded={open}
              aria-haspopup="menu"
              aria-label={`Open wallet menu for ${shortenAddress(account.address)}`}
            >
              <span className="font-mono text-[11px] font-medium text-white">
                {shortenAddress(account.address)}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition ${open ? "rotate-180" : ""}`}
                strokeWidth={1.5}
              />
            </button>

            {open ? (
              <div
                className="absolute right-0 z-50 mt-2 w-[min(calc(100vw-2rem),304px)] overflow-hidden rounded-2xl border border-white/12 bg-[#101831]/96 py-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl"
                role="menu"
              >
                <div className="border-b border-white/[0.06] px-3.5 py-2.5">
                  <p className="snapzo-micro-label inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase text-zinc-400">
                    <Wallet className="h-3.5 w-3.5" />
                    Wallet
                  </p>
                  <p
                    className="mt-0.5 truncate font-mono text-[11px] text-zinc-200"
                    title={account.address}
                  >
                    {account.address}
                  </p>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void copyAddress(account.address)}
                    className="snapzo-pressable mt-2 inline-flex snapzo-hit-44 items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-white/[0.08]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? "Copied" : "Copy address"}
                  </button>
                </div>

                {unsupported ? (
                  <div className="px-3.5 py-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        openChainModal();
                      }}
                      className="snapzo-pressable w-full rounded-xl bg-amber-600/90 px-3 py-2.5 text-center text-xs font-semibold text-white hover:bg-amber-500"
                    >
                      Switch to Mezo testnet
                    </button>
                  </div>
                ) : (
                  <div className="px-3.5 py-2.5">
                    <p className="snapzo-micro-label text-[10px] font-semibold uppercase text-zinc-400">
                      Balances
                    </p>
                    <dl className="mt-2 space-y-1.5 text-xs">
                      <div className="flex justify-between gap-3 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5">
                        <dt className="inline-flex items-center gap-1.5 text-zinc-300">
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#f7931a] text-black">
                            <Bitcoin className="h-2.5 w-2.5" strokeWidth={2.2} />
                          </span>
                          BTC (gas)
                        </dt>
                        <dd className="font-mono text-zinc-100 tabular-nums">
                          {native.isPending ? "…" : native.error ? "—" : `${btcFormatted ?? "0"}`}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 rounded-lg border border-fuchsia-300/20 bg-fuchsia-500/[0.09] px-2.5 py-1.5">
                        <dt className="flex items-center gap-1.5 text-zinc-200">
                          <MusdInlineIcon />
                          MUSD
                        </dt>
                        <dd className="font-mono text-zinc-100 tabular-nums">
                          {musdBalance.isPending
                            ? "…"
                            : musdBalance.error
                              ? "—"
                              : (musdFormatted ?? "0")}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 rounded-lg border border-violet-300/20 bg-violet-500/[0.09] px-2.5 py-1.5">
                        <dt className="flex items-center gap-1 text-zinc-200">
                          <SnapInlineIcon decorative />
                          SNAP
                        </dt>
                        <dd className="font-mono text-zinc-100 tabular-nums">
                          {snapBalance.isPending
                            ? "…"
                            : snapBalance.error
                              ? "—"
                              : (snapFormatted ?? "0")}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 rounded-lg border border-cyan-300/20 bg-cyan-500/[0.08] px-2.5 py-1.5">
                        <dt className="flex items-center gap-1.5 text-zinc-200">
                          <MezoInlineIcon decorative />
                          MEZO
                        </dt>
                        <dd className="font-mono text-zinc-100 tabular-nums">
                          {mezoBalance.isPending
                            ? "…"
                            : mezoBalance.error
                              ? "—"
                              : (mezoFormatted ?? "0")}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-2 rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5">
                      <p className="snapzo-micro-label text-[9px] font-semibold uppercase text-zinc-500">
                        MUSD Contract
                      </p>
                      <p
                        className="mt-0.5 truncate font-mono text-[10px] text-zinc-400"
                        title={MUSD_ADDRESS_MEZO_TESTNET}
                      >
                        {MUSD_ADDRESS_MEZO_TESTNET}
                      </p>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      <Link
                        href="/swap"
                        onClick={close}
                        role="menuitem"
                        className="snapzo-pressable flex w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-300/25 bg-fuchsia-500/12 py-2.5 text-xs font-semibold text-white hover:bg-fuchsia-500/20"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                        Swap BTC ↔ MUSD
                      </Link>
                      <Link
                        href="/earn"
                        onClick={close}
                        role="menuitem"
                        className="snapzo-pressable flex w-full items-center justify-center gap-2 rounded-xl border border-violet-300/25 bg-violet-500/12 py-2.5 text-xs font-semibold text-white hover:bg-violet-500/20"
                      >
                        <PiggyBank className="h-3.5 w-3.5" aria-hidden />
                        Earn (MUSD vault)
                      </Link>
                      {canSeeAdmin ? (
                        <Link
                          href="/admin/snapzo"
                          onClick={close}
                          role="menuitem"
                          className="snapzo-pressable flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-500/10 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500/18"
                        >
                          <Shield className="h-3.5 w-3.5" aria-hidden />
                          SnapZo hub admin
                        </Link>
                      ) : null}
                    </div>
                  </div>
                )}

                <div className="border-t border-white/[0.06] p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      close();
                      disconnect();
                    }}
                    disabled={isDisconnecting}
                    className="snapzo-pressable flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Disconnect
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
