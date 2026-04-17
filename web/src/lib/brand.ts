/** Product copy — SnapZO: Social-Fi yield + SNAP shares on Mezo */

export const APP_NAME = "SnapZO";

/** Splash / hero headline (under the product name) */
export const APP_SPLASH_HEADLINE = "The Social-Fi Yield Engine for Mezo";

/** Splash / marketing one-liner */
export const APP_SPLASH_TAGLINE =
  "Turn social engagement into automated yield with gasless, yield-bearing SNAP shares.";

/** Tighter hero body (splash / onboarding intro) */
export const APP_SPLASH_BODY =
  "Deposit MUSD to mint SNAP — a hub share that accrues MUSD and MEZO rewards while you scroll. Creators get paid in SNAP so earnings start compounding the moment they land. Gasless flows via EIP-712 relayers on Mezo testnet.";

/** Short blurb under the logo in the feed header (single readable line) */
export const APP_FEED_BLURB =
  "Social yield on Mezo · MUSD deposits → SNAP shares · gasless relayers (testnet).";

/**
 * Creator economics: unlocks and tips are quoted in MUSD for clarity, but fans send SNAP
 * on-chain at the live hub ratio. SNAP is an 18-decimal receipt (1:1 with sMUSD wei added on
 * your deposit), so creators hold MUSD-linked value until they redeem SNAP for MUSD.
 */
export const APP_CREATOR_REVENUE_EXPLAINER =
  "Fans see MUSD prices on the feed; their wallet sends the matching SNAP amount. SNAP is the hub share token — each unit is a slice of pooled MUSD + strategy yield. While you hold SNAP, your slice rides with the pool; withdrawing turns it back into MUSD when you want spendable stablecoin.";

/** One line for tight UI (banners, footnotes). */
export const APP_CREATOR_REVENUE_ONE_LINER =
  "Earn: MUSD -> hub -> SNAP. Feed prices are MUSD, settlement is SNAP (~2dp).";
