/** Matches hub `MUSD_WEI_PER_SNAP_UNIT` (MUSD 18d → SNAP 6d, 1:1 human on first mint). */
export const MUSD_WEI_PER_SNAP_BASE = BigInt(1_000_000_000_000);

/** One full SNAP token in base units (6 decimals). */
export const SNAP_ONE_IN_BASE_UNITS = BigInt(1_000_000);

/**
 * SNAP base units for a MUSD wei quote when the pool already has supply (same as hub `mulDiv` ceil).
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
    return musdWei / MUSD_WEI_PER_SNAP_BASE;
  }
  return (musdWei * totalSupplySnap + totalAssetsMusd - BigInt(1)) / totalAssetsMusd;
}
