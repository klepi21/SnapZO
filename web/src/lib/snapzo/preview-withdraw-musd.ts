/**
 * Withdraw preview helpers for SnapZo Earn.
 *
 * On Mezo testnet, vault `previewRedeem` / TVL ratios often read several× higher than the
 * economics implied by **SNAP minted 1:1 with Δ sMUSD wei**. UI uses `pickWithdrawDisplayMusdWei`
 * so users never see those inflated numbers as the primary quote.
 */

/**
 * sMUSD share wei the hub would free for `snapAmountWei`, matching
 * `Math.mulDiv(snapAmount, totalS, supply, Floor)` in `SnapZoHub._withdraw`.
 */
export function snapWithdrawToFreeSharesFloor(
  snapAmountWei: bigint,
  totalSmusdWei: bigint,
  snapSupplyWei: bigint,
): bigint | undefined {
  if (snapSupplyWei <= BigInt(0) || snapAmountWei <= BigInt(0) || totalSmusdWei <= BigInt(0)) {
    return undefined;
  }
  const shares = (snapAmountWei * totalSmusdWei) / snapSupplyWei;
  return shares > BigInt(0) ? shares : undefined;
}

/** SNAP / MUSD both use 18 decimals on Mezo — hub mints SNAP 1:1 with Δ sMUSD wei. */
export type WithdrawMusdDisplayBasis = "vault-marginal" | "snap-smusd-parity";

/**
 * Wallet-facing MUSD preview for a withdraw.
 *
 * SnapZo mints SNAP 1:1 with **sMUSD share wei** added on deposit, so the honest default is
 * **1 freed sMUSD wei ≈ 1 MUSD wei** in the UI. Mezo testnet vault marginal quotes often imply
 * several× more MUSD for the same shares — we only use the vault marginal estimate when it stays
 * within **50%–150%** of that parity band.
 */
export function pickWithdrawDisplayMusdWei(
  toFreeSmusdWei: bigint | undefined,
  vaultMarginalMusdWei: bigint | undefined,
): { musdWei: bigint | undefined; basis: WithdrawMusdDisplayBasis } {
  if (toFreeSmusdWei === undefined || toFreeSmusdWei <= BigInt(0)) {
    return { musdWei: undefined, basis: "snap-smusd-parity" };
  }
  const parity = toFreeSmusdWei;
  if (vaultMarginalMusdWei === undefined || vaultMarginalMusdWei <= BigInt(0)) {
    return { musdWei: parity, basis: "snap-smusd-parity" };
  }
  const v = vaultMarginalMusdWei;
  if (v * BigInt(100) >= parity * BigInt(50) && v * BigInt(100) <= parity * BigInt(150)) {
    return { musdWei: v, basis: "vault-marginal" };
  }
  return { musdWei: parity, basis: "snap-smusd-parity" };
}
