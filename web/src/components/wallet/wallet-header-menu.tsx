"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowLeftRight, ChevronDown, LogOut, PiggyBank, Shield } from "lucide-react";
import { useChainId, useDisconnect } from "wagmi";
import { useMezoBalancesReadout } from "@/hooks/use-mezo-balances-readout";
import { mezoTestnet } from "@/lib/chains/mezo-testnet";
import { MusdInlineIcon } from "@/components/icons/musd-inline-icon";
import { MUSD_ADDRESS_MEZO_TESTNET } from "@/lib/constants/musd";
import { isSnapZoHubConfigured } from "@/lib/constants/snapzo-hub";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletHeaderMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { disconnect, isPending: isDisconnecting } = useDisconnect();
  const chainId = useChainId();
  const { native, musdBalance, btcFormatted, musdFormatted } =
    useMezoBalancesReadout();

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
              className="border-0 bg-transparent px-2 py-2 text-sm font-semibold tracking-tight text-white underline-offset-4 transition hover:opacity-90 hover:underline active:opacity-80"
            >
              Connect
            </button>
          );
        }

        return (
          <div ref={rootRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex h-10 items-center gap-1 border-0 bg-transparent px-2 py-1.5 text-left transition hover:opacity-90 active:opacity-80"
              aria-expanded={open}
              aria-haspopup="menu"
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
                className="absolute right-0 z-50 mt-2 w-[min(calc(100vw-2rem),276px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1018]/96 py-1 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl"
                role="menu"
              >
                <div className="border-b border-white/[0.06] px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Wallet
                  </p>
                  <p
                    className="mt-0.5 truncate font-mono text-[11px] text-zinc-300"
                    title={account.address}
                  >
                    {account.address}
                  </p>
                </div>

                {unsupported ? (
                  <div className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        openChainModal();
                      }}
                      className="w-full rounded-lg bg-amber-600/90 px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-amber-500"
                    >
                      Switch to Mezo testnet
                    </button>
                  </div>
                ) : (
                  <div className="px-3 py-2">
                    <p className="text-[10px] text-zinc-500">Balances</p>
                    <dl className="mt-2 space-y-1.5 text-xs">
                      <div className="flex justify-between gap-3">
                        <dt className="text-zinc-500">BTC (gas)</dt>
                        <dd className="font-mono text-zinc-100">
                          {native.isPending ? "…" : native.error ? "—" : `${btcFormatted ?? "0"}`}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="flex items-center gap-1.5 text-zinc-500">
                          <MusdInlineIcon size={14} />
                          <span className="sr-only">MUSD</span>
                        </dt>
                        <dd className="font-mono text-zinc-100">
                          {musdBalance.isPending
                            ? "…"
                            : musdBalance.error
                              ? "—"
                              : (musdFormatted ?? "0")}
                        </dd>
                      </div>
                    </dl>
                    <p
                      className="mt-2 truncate font-mono text-[9px] text-zinc-600"
                      title={MUSD_ADDRESS_MEZO_TESTNET}
                    >
                      {MUSD_ADDRESS_MEZO_TESTNET}
                    </p>
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      <Link
                        href="/swap"
                        onClick={close}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-xs font-semibold text-white transition hover:bg-white/[0.08]"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                        Swap BTC ↔ MUSD
                      </Link>
                      <Link
                        href="/earn"
                        onClick={close}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-xs font-semibold text-white transition hover:bg-white/[0.08]"
                      >
                        <PiggyBank className="h-3.5 w-3.5" aria-hidden />
                        Earn (MUSD vault)
                      </Link>
                      {hubAdmin ? (
                        <Link
                          href="/admin/snapzo"
                          onClick={close}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-xs font-semibold text-white transition hover:bg-white/[0.08]"
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
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
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
