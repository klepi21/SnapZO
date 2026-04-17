const WAD = BigInt("1000000000000000000");

/** One full SNAP token in base units (18 decimals, same as sMUSD). */
export const SNAP_ONE_IN_BASE_UNITS = WAD;

/**
 * SNAP base units for a MUSD wei quote at the live hub ratio (same as `ceil(musd * ts / ta)`).
 * Use **ceil** so tips/unlocks deliver at least the quoted MUSD worth.
 */
export function musdWeiToSnapBaseUnitsCeil(
  musdWei: bigint,
  totalSupplySnap: bigint,
  totalAssetsMusd: bigint,
): bigint {
  if (totalAssetsMusd <= BigInt(0)) {
    return BigInt(0);
  }
  if (totalSupplySnap <= BigInt(0)) {
    return BigInt(0);
  }
  return (musdWei * totalSupplySnap + totalAssetsMusd - BigInt(1)) / totalAssetsMusd;
}
