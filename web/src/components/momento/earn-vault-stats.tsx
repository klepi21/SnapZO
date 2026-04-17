"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { useReadContracts } from "wagmi";
import { getPublicClient } from "wagmi/actions";

import { MusdInlineIcon } from "@/components/icons/musd-inline-icon";
import { mezoTestnet } from "@/lib/chains/mezo-testnet";
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
  erc20TotalSupplyAbi,
  SNAPZO_HUB_ADDRESS,
  SNAPZO_SNAP_TOKEN_ADDRESS,
} from "@/lib/constants/snapzo-hub";
import { SNAP_ONE_IN_BASE_UNITS } from "@/lib/snapzo/musd-snap-quote";
import { wagmiConfig } from "@/lib/wagmi/config";

const WAD = BigInt("1000000000000000000");
const z = BigInt(0);

/** One full sMUSD vault share (18 decimals on Mezo testnet). */
const ONE_SMUSD_SHARE_WEI = WAD;

/** sMUSD share token uses 18 decimals on Mezo (same as MUSD). */
const SMUSD_DECIMALS = 18;

function formatUnitsMax2dp(value: bigint | undefined, decimals: number): string {
  if (value === undefined) {
    return "—";
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

/** Human amount with up to `fractionDigits` fractional digits (trim trailing zeros). */
function formatBigintFixed(
  value: bigint | undefined,
  decimals: number,
  fractionDigits: number,
): string {
  if (value === undefined) {
    return "—";
  }
  const full = formatUnits(value, decimals);
  const dot = full.indexOf(".");
  if (dot === -1) {
    return full;
  }
  const intPart = full.slice(0, dot);
  const fracRaw = full.slice(dot + 1, dot + 1 + fractionDigits);
  const frac = fracRaw.replace(/0+$/, "");
  return frac.length > 0 ? `${intPart}.${frac}` : intPart;
}

/** Up to 3 fractional digits, trim trailing zeros (MUSD wei → display). */
function formatMusdWeiUpTo3(musdWei: bigint | undefined): string {
  if (musdWei === undefined) {
    return "—";
  }
  const k = BigInt(1000);
  if (musdWei === z) {
    return "0";
  }
  const scaled = (musdWei * k) / WAD;
  const intPart = scaled / k;
  let frac = (scaled % k).toString().padStart(3, "0");
  frac = frac.replace(/0+$/, "");
  return frac.length > 0 ? `${intPart}.${frac}` : `${intPart}`;
}

type SmusdMusdRateResult =
  | {
      kind: "ok";
      /** MUSD wei per `ONE_SMUSD_SHARE_WEI` (1e18) vault shares — vault view or TVL ratio. */
      musdWeiPerSmusd: bigint;
      source: "vault-view" | "vault-linear";
    }
  | { kind: "fail"; message: string };

async function fetchMusdPerOneSmusd(): Promise<SmusdMusdRateResult> {
  const client = getPublicClient(wagmiConfig, { chainId: mezoTestnet.id });
  if (!client) {
    return { kind: "fail", message: "No RPC client" };
  }

  const readOpts = { chain: mezoTestnet } as const;
  const base = {
    address: MEZO_MUSD_VAULT,
    abi: mezoMusdVaultAbi,
    args: [ONE_SMUSD_SHARE_WEI] as const,
  } as const;

  try {
    const musdWeiPerSmusd = await client.readContract({
      ...readOpts,
      ...base,
      functionName: "previewRedeem",
    });
    return { kind: "ok", musdWeiPerSmusd, source: "vault-view" };
  } catch {
    try {
      const musdWeiPerSmusd = await client.readContract({
        ...readOpts,
        ...base,
        functionName: "convertToAssets",
      });
      return { kind: "ok", musdWeiPerSmusd, source: "vault-view" };
    } catch {
      try {
        const [vaultTotalSupply, musdInVault] = await Promise.all([
          client.readContract({
            ...readOpts,
            address: MEZO_MUSD_VAULT,
            abi: mezoMusdVaultAbi,
            functionName: "totalSupply",
          }),
          client.readContract({
            ...readOpts,
            address: MUSD_ADDRESS_MEZO_TESTNET,
            abi: erc20BalanceAbi,
            functionName: "balanceOf",
            args: [MEZO_MUSD_VAULT],
          }),
        ]);
        if (vaultTotalSupply > z) {
          const rawLinear = (musdInVault * ONE_SMUSD_SHARE_WEI) / vaultTotalSupply;
          if (rawLinear > z) {
            return { kind: "ok", musdWeiPerSmusd: rawLinear, source: "vault-linear" };
          }
        }
      } catch {
        /* fall through */
      }
      return {
        kind: "fail",
        message: "Could not read MUSD per 1 sMUSD (vault preview reverted).",
      };
    }
  }
}

export function EarnVaultStats() {
  const hub = SNAPZO_HUB_ADDRESS;

  const { data, isPending, isError } = useReadContracts({
    contracts: [
      {
        chainId: mezoTestnet.id,
        address: MEZO_SMUSD_GAUGE,
        abi: mezoSmusdGaugeAbi,
        functionName: "balanceOf",
        args: [hub],
      },
      {
        chainId: mezoTestnet.id,
        address: MEZO_SMUSD_GAUGE,
        abi: mezoSmusdGaugeAbi,
        functionName: "earned",
        args: [hub],
      },
      {
        chainId: mezoTestnet.id,
        address: MEZO_MUSD_VAULT,
        abi: mezoMusdVaultAbi,
        functionName: "balanceOf",
        args: [hub],
      },
      {
        chainId: mezoTestnet.id,
        address: SNAPZO_SNAP_TOKEN_ADDRESS,
        abi: erc20TotalSupplyAbi,
        functionName: "totalSupply",
      },
    ],
    query: {
      staleTime: 30_000,
    },
  });

  const stStaked = data?.[0]?.status === "success" ? data[0].result : undefined;
  const pendingRewards = data?.[1]?.status === "success" ? data[1].result : undefined;
  const stIdle = data?.[2]?.status === "success" ? data[2].result : undefined;
  const snapSupply = data?.[3]?.status === "success" ? data[3].result : undefined;

  const totalSmusdWei = useMemo(() => {
    if (stStaked === undefined || stIdle === undefined) {
      return undefined;
    }
    return stStaked + stIdle;
  }, [stIdle, stStaked]);

  const smusdMusdRateQuery = useQuery({
    queryKey: ["earnSmusdMusdPerFullShare", mezoTestnet.id] as const,
    queryFn: () => fetchMusdPerOneSmusd(),
    staleTime: 30_000,
  });

  const baseReadsReady =
    data !== undefined &&
    !isPending &&
    data[0]?.status === "success" &&
    data[2]?.status === "success" &&
    data[3]?.status === "success";

  const musdWeiPerSmusd =
    smusdMusdRateQuery.data?.kind === "ok" ? smusdMusdRateQuery.data.musdWeiPerSmusd : undefined;

  const smusdPerSnapWei = useMemo(() => {
    if (totalSmusdWei === undefined || snapSupply === undefined || snapSupply === z) {
      return undefined;
    }
    return (totalSmusdWei * SNAP_ONE_IN_BASE_UNITS) / snapSupply;
  }, [snapSupply, totalSmusdWei]);

  const musdWeiPerSnap = useMemo(() => {
    if (musdWeiPerSmusd === undefined || smusdPerSnapWei === undefined || smusdPerSnapWei === z) {
      return undefined;
    }
    return (musdWeiPerSmusd * smusdPerSnapWei) / ONE_SMUSD_SHARE_WEI;
  }, [musdWeiPerSmusd, smusdPerSnapWei]);

  const loading = isPending && !data;

  const smusdRateLabel =
    smusdMusdRateQuery.isPending || smusdMusdRateQuery.isFetching
      ? "…"
      : smusdMusdRateQuery.data?.kind === "ok"
        ? formatMusdWeiUpTo3(musdWeiPerSmusd)
        : "—";

  const snapToMusdLabel =
    !baseReadsReady || snapSupply === undefined || snapSupply === z
      ? loading
        ? "…"
        : "—"
      : totalSmusdWei === undefined || totalSmusdWei === z
        ? "0"
        : smusdPerSnapWei === undefined || smusdPerSnapWei === z
          ? "—"
          : smusdMusdRateQuery.isPending || smusdMusdRateQuery.isFetching
            ? "…"
            : musdWeiPerSnap !== undefined
              ? formatMusdWeiUpTo3(musdWeiPerSnap)
              : "—";

  const smusdRateHint =
    smusdMusdRateQuery.data?.kind === "ok"
      ? smusdMusdRateQuery.data.source === "vault-linear"
        ? "MUSD.balanceOf(MUSD vault) × 1 sMUSD ÷ vault.totalSupply. On testnet `previewRedeem` reverts; this TVL ratio is what we can read on-chain (actual `withdraw` payouts can differ)."
        : "From vault previewRedeem / convertToAssets for 1 full sMUSD (1e18 shares)."
      : smusdMusdRateQuery.data?.kind === "fail"
        ? smusdMusdRateQuery.data.message
        : "Vault preview or TVL ratio for 1 sMUSD.";

  const snapHint =
    musdWeiPerSnap !== undefined && musdWeiPerSmusd !== undefined && smusdPerSnapWei !== undefined
      ? "(Hub sMUSD per 1 SNAP) × (MUSD per 1 sMUSD). Hub sMUSD = gauge.balanceOf(hub) + vault.balanceOf(hub); per-SNAP slice = total × 1e6 ÷ SNAP supply."
      : "Need hub sMUSD position and SNAP supply.";

  return (
    <section
      className="rounded-[22px] border border-white/[0.08] bg-zinc-900/50 px-4 py-4 backdrop-blur-sm sm:px-5"
      aria-label="SnapZo hub gauge position"
    >
      <h2 className="text-sm font-semibold tracking-tight text-white">Hub on-chain</h2>

      {isError ? (
        <p className="mt-3 text-sm text-amber-200/90">
          Could not load stats. Check RPC / network.
        </p>
      ) : (
        <dl className="mt-4 space-y-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-3">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Hub sMUSD total (gauge + vault)
            </dt>
            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-emerald-200/95">
              {loading || totalSmusdWei === undefined ? "…" : formatBigintFixed(totalSmusdWei, SMUSD_DECIMALS, 6)}
            </dd>
            <p className="mt-1.5 text-[10px] leading-snug text-zinc-600">
              Staked{" "}
              <span className="font-mono text-zinc-400">
                {loading ? "…" : formatBigintFixed(stStaked, SMUSD_DECIMALS, 6)}
              </span>
              {" · "}
              Idle on vault{" "}
              <span className="font-mono text-zinc-400">
                {loading ? "…" : formatBigintFixed(stIdle, SMUSD_DECIMALS, 6)}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Hub pending rewards
              </dt>
              <dd className="mt-1 font-mono text-base font-semibold tabular-nums text-amber-100/90">
                {loading ? "…" : formatUnitsMax2dp(pendingRewards, MUSD_DECIMALS)}
              </dd>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                SNAP total supply
              </dt>
              <dd className="mt-1 font-mono text-base font-semibold tabular-nums text-zinc-200">
                {loading || snapSupply === undefined ? "…" : formatBigintFixed(snapSupply, 6, 4)}
              </dd>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-3">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              1 sMUSD → MUSD
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-base font-semibold tabular-nums text-white">
              <span>{smusdRateLabel}</span>
              <MusdInlineIcon
                size={18}
                decorative
                className="shrink-0 rounded-full object-cover"
              />
              <span className="text-sm font-medium text-zinc-300">MUSD</span>
            </dd>
            <p
              className={`mt-2 text-[10px] leading-snug ${
                smusdMusdRateQuery.data?.kind === "fail"
                  ? "text-amber-200/80"
                  : "text-zinc-600"
              }`}
            >
              {smusdRateHint}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-3">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              1 SNAP → MUSD (implied)
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-base font-semibold tabular-nums text-white">
              <span>{snapToMusdLabel}</span>
              <MusdInlineIcon
                size={18}
                decorative
                className="shrink-0 rounded-full object-cover"
              />
              <span className="text-sm font-medium text-zinc-300">MUSD</span>
            </dd>
            <p className="mt-2 text-[10px] leading-snug text-zinc-600">{snapHint}</p>
          </div>
        </dl>
      )}
    </section>
  );
}
