import type { Address, PublicClient } from "viem";
import { getAddress, parseAbiItem } from "viem";

import { snapZoHubAdminAbi } from "@/lib/constants/snapzo-hub-admin-abi";

const relayerUpdated = parseAbiItem(
  "event RelayerUpdated(address indexed relayer, bool allowed)",
);

const LOG_CHUNK = BigInt(10_000);

export interface HubRelayerRow {
  address: Address;
  allowedFromLogs: boolean;
  isRelayerOnChain: boolean;
}

/**
 * Walk `RelayerUpdated` logs in RPC-sized chunks, merge by (block, logIndex), then verify each
 * address that ends `allowed: true` with `isRelayer`.
 */
export async function fetchHubRelayerRows(
  publicClient: PublicClient,
  hub: Address,
  fromBlock: bigint,
): Promise<HubRelayerRow[]> {
  const latest = await publicClient.getBlockNumber();
  let from = fromBlock;
  const entries: {
    relayer: Address;
    allowed: boolean;
    block: bigint;
    logIndex: number;
  }[] = [];

  while (from <= latest) {
    const to =
      from + LOG_CHUNK - BigInt(1) > latest ? latest : from + LOG_CHUNK - BigInt(1);
    const logs = await publicClient.getLogs({
      address: hub,
      event: relayerUpdated,
      fromBlock: from,
      toBlock: to,
    });

    for (const log of logs) {
      const relayer = log.args.relayer;
      const allowed = log.args.allowed;
      if (
        relayer === undefined ||
        allowed === undefined ||
        log.blockNumber === undefined ||
        log.logIndex === undefined
      ) {
        continue;
      }
      entries.push({
        relayer: getAddress(relayer),
        allowed,
        block: log.blockNumber,
        logIndex: log.logIndex,
      });
    }
    from = to + BigInt(1);
  }

  entries.sort((a, b) =>
    a.block === b.block ? a.logIndex - b.logIndex : a.block < b.block ? -1 : 1,
  );

  const finalAllowed = new Map<string, boolean>();
  for (const e of entries) {
    finalAllowed.set(e.relayer.toLowerCase(), e.allowed);
  }

  const candidates = [...finalAllowed.entries()]
    .filter(([, allowed]) => allowed)
    .map(([k]) => getAddress(k as Address))
    .sort((a, b) => a.localeCompare(b));

  const rows: HubRelayerRow[] = [];
  for (const address of candidates) {
    const isRelayerOnChain = await publicClient.readContract({
      address: hub,
      abi: snapZoHubAdminAbi,
      functionName: "isRelayer",
      args: [address],
    });
    rows.push({
      address,
      allowedFromLogs: true,
      isRelayerOnChain,
    });
  }

  return rows;
}
