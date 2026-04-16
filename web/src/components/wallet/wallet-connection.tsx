"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useDisconnect } from "wagmi";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletConnection({
  appearance = "default",
  layout = "inline",
}: {
  appearance?: "default" | "onDark";
  /** `fullWidth`: single row for header bar (no max-width squeeze). */
  layout?: "inline" | "fullWidth";
}) {
  const { disconnect, isPending: isDisconnecting } = useDisconnect();
  const onDark = appearance === "onDark";
  const bar = layout === "fullWidth";

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        openConnectModal,
        openChainModal,
      }) => {
        if (!mounted) {
          return (
            <div
              className={
                onDark
                  ? `animate-pulse rounded-xl bg-white/10 ${bar ? "h-10 w-full" : "h-9 min-w-[120px]"}`
                  : "h-10 min-w-[148px] animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800"
              }
              aria-busy="true"
              aria-label="Loading wallet controls"
            />
          );
        }

        if (!account) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className={
                onDark
                  ? bar
                    ? "w-full rounded-xl border border-white/15 bg-gradient-to-r from-white/12 to-white/[0.08] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/25 hover:from-white/16"
                    : "rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
                  : "rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              }
            >
              Connect wallet
            </button>
          );
        }

        const unsupported = chain?.unsupported === true;

        if (unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className={
                onDark
                  ? "w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-500"
                  : "w-full rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
              }
            >
              Wrong network — tap to switch
            </button>
          );
        }

        const rowClass = bar
          ? "flex w-full min-w-0 flex-nowrap items-center justify-between gap-3"
          : "flex max-w-[220px] flex-wrap items-center justify-end gap-1.5 sm:gap-2";

        return (
          <div className={rowClass}>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <output
                className={
                  onDark
                    ? "min-w-0 truncate rounded-lg border border-white/15 bg-black/30 px-2.5 py-1.5 font-mono text-[11px] text-white sm:text-xs"
                    : "rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 font-mono text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                }
                aria-live="polite"
                title={account.address}
              >
                {shortenAddress(account.address)}
              </output>
              {chain ? (
                <span
                  className={
                    onDark
                      ? "shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-300"
                      : "text-xs text-zinc-500 dark:text-zinc-400"
                  }
                >
                  {onDark ? "Mezo testnet" : (chain.name ?? `Chain ${chain.id}`)}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => disconnect()}
              disabled={isDisconnecting}
              className={
                onDark
                  ? "shrink-0 rounded-xl border border-white/20 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-50 sm:px-4 sm:text-sm"
                  : "rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
              }
            >
              Disconnect
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
