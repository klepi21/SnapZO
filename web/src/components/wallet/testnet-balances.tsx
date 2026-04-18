"use client";

import { MusdInlineIcon } from "@/components/icons/musd-inline-icon";
import { mezoTestnet } from "@/lib/chains/mezo-testnet";
import { MUSD_ADDRESS_MEZO_TESTNET } from "@/lib/constants/musd";
import { useMezoBalancesReadout } from "@/hooks/use-mezo-balances-readout";

export function TestnetBalances({
  theme = "default",
}: {
  theme?: "default" | "snapzo";
}) {
  const shell = theme === "snapzo";
  const {
    isConnected,
    onMezoTestnet,
    native,
    musdBalance,
    btcFormatted,
    musdFormatted,
  } = useMezoBalancesReadout();

  if (!isConnected) {
    return null;
  }

  if (!onMezoTestnet) {
    return (
      <p
        className={
          shell
            ? "rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
            : "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        }
      >
        Switch to <strong>Mezo testnet</strong> (chain {mezoTestnet.id}) to load
        BTC and{" "}
        <span className="inline-flex items-center gap-0.5 align-middle">
          <MusdInlineIcon />
        </span>{" "}
        balances.
      </p>
    );
  }

  return (
    <section
      className={
        shell
          ? "rounded-[20px] border border-white/[0.06] bg-[#0c1018] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
          : "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      }
      aria-label="Testnet balances"
    >
      <h2
        className={
          shell
            ? "text-sm font-semibold text-white"
            : "text-sm font-semibold text-zinc-900 dark:text-zinc-50"
        }
      >
        Balances (Mezo testnet)
      </h2>
      <p
        className={
          shell
            ? "mt-1 font-mono text-[10px] text-zinc-500"
            : "mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400"
        }
      >
        <span className="inline-flex items-center gap-1 align-middle">
          <MusdInlineIcon />
        </span>
        : {MUSD_ADDRESS_MEZO_TESTNET}
      </p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className={shell ? "text-zinc-500" : "text-zinc-600 dark:text-zinc-400"}>
            BTC (gas)
          </dt>
          <dd className={shell ? "font-mono text-zinc-100" : "font-mono text-zinc-900 dark:text-zinc-100"}>
            {native.isPending ? (
              <span className="text-zinc-400">…</span>
            ) : native.error ? (
              <span
                className={shell ? "text-red-400" : "text-red-600"}
                title={native.error.message}
              >
                Error
              </span>
            ) : (
              `${btcFormatted ?? "0"} BTC`
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className={shell ? "text-zinc-500" : "text-zinc-600 dark:text-zinc-400"}>
            <span className="inline-flex items-center gap-1.5">
              <MusdInlineIcon />
              <span className="sr-only">MUSD</span>
            </span>
          </dt>
          <dd className={shell ? "font-mono text-zinc-100" : "font-mono text-zinc-900 dark:text-zinc-100"}>
            {musdBalance.isPending ? (
              <span className="text-zinc-400">…</span>
            ) : musdBalance.error ? (
              <span
                className={shell ? "text-red-400" : "text-red-600"}
                title={musdBalance.error.message}
              >
                Error
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                {musdFormatted ?? "0"}
                <MusdInlineIcon />
              </span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
