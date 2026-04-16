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
import { MUSD_DECIMALS } from "@/lib/constants/musd";
import {
  erc20TotalSupplyAbi,
  SNAPZO_HUB_ADDRESS,
  SNAPZO_SNAP_TOKEN_ADDRESS,
  snapZoHubWithdrawEventAbi,
} from "@/lib/constants/snapzo-hub";
import { wagmiConfig } from "@/lib/wagmi/config";

const WAD = BigInt("1000000000000000000");
const z = BigInt(0);

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

type SnapPreviewResult =
  | { kind: "ok"; musdWei: bigint; source: "vault-view" | "on-chain-withdraw" }
  | { kind: "dust" }
  | { kind: "fail"; message: string };

async function fetchLatestWithdrawMusdPerSnap(
  client: NonNullable<ReturnType<typeof getPublicClient>>,
): Promise<bigint | null> {
  const head = await client.getBlockNumber();
  const spans = [BigInt(80_000), BigInt(400_000), BigInt(2_000_000)];

  for (const span of spans) {
    const fromBlock = head > span ? head - span : z;
    try {
      const events = await client.getContractEvents({
        address: SNAPZO_HUB_ADDRESS,
        abi: snapZoHubWithdrawEventAbi,
        eventName: "Withdraw",
        fromBlock,
        toBlock: head,
        strict: true,
      });
      if (events.length === 0) {
        continue;
      }
      const sorted = [...events].sort((a, b) => {
        const ab = a.blockNumber;
        const bb = b.blockNumber;
        if (ab < bb) {
          return -1;
        }
        if (ab > bb) {
          return 1;
        }
        const ai = a.logIndex ?? 0;
        const bi = b.logIndex ?? 0;
        return ai < bi ? -1 : ai > bi ? 1 : 0;
      });
      const last = sorted[sorted.length - 1];
      const { sharesBurned, musdOut } = last.args;
      if (sharesBurned === z) {
        continue;
      }
      return (musdOut * WAD) / sharesBurned;
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchMusdForOneSnap(totalS: bigint, snapSupply: bigint): Promise<SnapPreviewResult> {
  if (snapSupply === z) {
    return { kind: "fail", message: "No SNAP supply" };
  }
  if (totalS === z) {
    return { kind: "ok", musdWei: z, source: "vault-view" };
  }
  const shares = (totalS * WAD) / snapSupply;
  if (shares === z) {
    return { kind: "dust" };
  }

  const client = getPublicClient(wagmiConfig, { chainId: mezoTestnet.id });
  if (!client) {
    return { kind: "fail", message: "No RPC client" };
  }

  const base = {
    address: MEZO_MUSD_VAULT,
    abi: mezoMusdVaultAbi,
    args: [shares] as const,
  } as const;

  const readOpts = { chain: mezoTestnet } as const;

  try {
    const musdWei = await client.readContract({
      ...readOpts,
      ...base,
      functionName: "previewRedeem",
    });
    return { kind: "ok", musdWei, source: "vault-view" };
  } catch {
    try {
      const musdWei = await client.readContract({
        ...readOpts,
        ...base,
        functionName: "convertToAssets",
      });
      return { kind: "ok", musdWei, source: "vault-view" };
    } catch {
      const fromLog = await fetchLatestWithdrawMusdPerSnap(client);
      if (fromLog !== null) {
        return { kind: "ok", musdWei: fromLog, source: "on-chain-withdraw" };
      }
      return {
        kind: "fail",
        message:
          "Vault preview reverted and no Withdraw logs found in recent blocks.",
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

  const totalS = useMemo(() => {
    if (stStaked === undefined || stIdle === undefined) {
      return undefined;
    }
    return stStaked + stIdle;
  }, [stIdle, stStaked]);

  const baseReadsReady =
    data !== undefined &&
    !isPending &&
    data[0]?.status === "success" &&
    data[2]?.status === "success" &&
    data[3]?.status === "success";

  const previewEnabled =
    baseReadsReady &&
    totalS !== undefined &&
    snapSupply !== undefined &&
    snapSupply > z;

  const previewQuery = useQuery({
    queryKey: [
      "earnSnapRedeemPreview",
      hub,
      totalS?.toString() ?? "x",
      snapSupply?.toString() ?? "x",
    ] as const,
    queryFn: () => fetchMusdForOneSnap(totalS!, snapSupply!),
    enabled: Boolean(previewEnabled && totalS !== undefined && snapSupply !== undefined),
    staleTime: 30_000,
  });

  const loading = isPending && !data;

  const snapToMusd = (() => {
    if (!baseReadsReady || snapSupply === undefined) {
      return loading ? "…" : "—";
    }
    if (snapSupply === z) {
      return "—";
    }
    if (totalS === undefined) {
      return "…";
    }
    if (totalS === z) {
      return "0";
    }
    if ((totalS * WAD) / snapSupply === z) {
      return "—";
    }
    if (previewQuery.isPending) {
      return "…";
    }
    if (previewQuery.isError) {
      return "—";
    }
    const r = previewQuery.data;
    if (!r) {
      return "—";
    }
    if (r.kind === "fail") {
      return "—";
    }
    if (r.kind === "dust") {
      return "—";
    }
    return formatMusdWeiUpTo3(r.musdWei);
  })();

  const ratioPending = previewEnabled && previewQuery.isPending;

  const previewHint =
    previewQuery.data?.kind === "ok"
      ? previewQuery.data.source === "on-chain-withdraw"
        ? "MUSD per SNAP from the latest hub Withdraw event (actual payout rate for that tx)."
        : "Vault view for the same sMUSD slice as a 1 SNAP withdraw."
      : previewQuery.data?.kind === "fail"
        ? previewQuery.data.message
        : "Vault quote or latest on-chain withdraw.";

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Hub sMUSD staked
              </dt>
              <dd className="mt-1 font-mono text-base font-semibold tabular-nums text-emerald-200/90">
                {loading ? "…" : formatUnitsMax2dp(stStaked, MUSD_DECIMALS)}
              </dd>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Hub pending rewards
              </dt>
              <dd className="mt-1 font-mono text-base font-semibold tabular-nums text-amber-100/90">
                {loading ? "…" : formatUnitsMax2dp(pendingRewards, MUSD_DECIMALS)}
              </dd>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-3">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              1 SNAP → MUSD
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-base font-semibold tabular-nums text-white">
              {ratioPending ? (
                "…"
              ) : (
                <>
                  <span>{snapToMusd}</span>
                  <MusdInlineIcon
                    size={18}
                    decorative
                    className="shrink-0 rounded-full object-cover"
                  />
                  <span className="text-sm font-medium text-zinc-300">MUSD</span>
                </>
              )}
            </dd>
            <p
              className={`mt-2 text-[10px] leading-snug ${
                previewQuery.data?.kind === "fail"
                  ? "text-amber-200/80"
                  : "text-zinc-600"
              }`}
            >
              {previewHint}
            </p>
          </div>
        </dl>
      )}
    </section>
  );
}
