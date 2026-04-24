import type { Address } from "viem";

/**
 * Mezo testnet (31611) — latest deploy from `contracts/README.md`.
 * Override with `NEXT_PUBLIC_SNAPZO_HUB_ADDRESS` / `NEXT_PUBLIC_SNAP_TOKEN_ADDRESS` /
 * `NEXT_PUBLIC_SNAPZO_SOCIAL_ADDRESS` / `NEXT_PUBLIC_SNAPZO_REWARDS_ADDRESS` /
 * `NEXT_PUBLIC_SNAPZO_SUBSCRIPTIONS_ADDRESS` for other envs.
 */
const HUB_MEZO_TESTNET =
  "0x9Cd1C98aC5C4F68881dcC63Ded54Ddb239033BfD" as const;
const SNAP_MEZO_TESTNET =
  "0xCA1A5C01c533dDE957f0eFC79b25906b0187039D" as const;
/** `SnapZoSocial` UUPS proxy — Part F (`contracts/src/SnapZoSocial.sol`). */
const SOCIAL_MEZO_TESTNET =
  "0x30200f8ee05a34a3062CAbFe42c18f7b894239C4" as const;
/** `SnapZoRewards` — Merkle rewards distributor (`contracts/src/SnapZoRewards.sol`). */
const REWARDS_MEZO_TESTNET =
  "0x66884173243B2C9Bc056753376B714b402A7E801" as const;
/** `SnapZoSubscriptions` UUPS proxy — OnlySnaps subscriptions. */
const SUBSCRIPTIONS_MEZO_TESTNET =
  "0xEF1E367fC508AcEfCF9F099AeCcE01cE6601eA5F" as const;

function pickAddr(env: string | undefined, fallback: string): Address {
  const t = (env ?? "").trim();
  if (t.startsWith("0x") && t.length === 42) {
    return t as Address;
  }
  return fallback as Address;
}

/**
 * First block where the current default hub proxy appears (deploy tx).
 * Override with `NEXT_PUBLIC_SNAPZO_HUB_DEPLOY_BLOCK` if you redeploy.
 */
export const SNAPZO_HUB_DEPLOY_BLOCK = (() => {
  const raw = process.env.NEXT_PUBLIC_SNAPZO_HUB_DEPLOY_BLOCK?.trim();
  if (raw && /^\d+$/.test(raw)) {
    return BigInt(raw);
  }
  return BigInt(12_397_374);
})();

/** UUPS proxy — EIP-712 `verifyingContract` and contract calls. */
export const SNAPZO_HUB_ADDRESS = pickAddr(
  process.env.NEXT_PUBLIC_SNAPZO_HUB_ADDRESS,
  HUB_MEZO_TESTNET,
);

export const SNAPZO_SNAP_TOKEN_ADDRESS = pickAddr(
  process.env.NEXT_PUBLIC_SNAP_TOKEN_ADDRESS,
  SNAP_MEZO_TESTNET,
);

/** UUPS proxy — EIP-712 `verifyingContract` for social economy txs (`SnapZoSocial`). */
export const SNAPZO_SOCIAL_ADDRESS = pickAddr(
  process.env.NEXT_PUBLIC_SNAPZO_SOCIAL_ADDRESS,
  SOCIAL_MEZO_TESTNET,
);

/** Merkle rewards distributor for creator MEZO rewards (10% fee share path). */
export const SNAPZO_REWARDS_ADDRESS = pickAddr(
  process.env.NEXT_PUBLIC_SNAPZO_REWARDS_ADDRESS ??
    process.env.NEXT_PUBLIC_SNAPZO_REWARDS_PROXY,
  REWARDS_MEZO_TESTNET,
);

/** UUPS proxy — EIP-712 `verifyingContract` for OnlySnaps subscriptions. */
export const SNAPZO_SUBSCRIPTIONS_ADDRESS = pickAddr(
  process.env.NEXT_PUBLIC_SNAPZO_SUBSCRIPTIONS_ADDRESS,
  SUBSCRIPTIONS_MEZO_TESTNET,
);

/** SNAP uses 18 decimals on-chain (1:1 wei with sMUSD minted to the hub on deposit). */
export const SNAP_DECIMALS = 18;

/** Set `NEXT_PUBLIC_SNAPZO_HUB_UI=false` to hide the hub card on `/earn`. */
export function isSnapZoHubConfigured(): boolean {
  if (process.env.NEXT_PUBLIC_SNAPZO_HUB_UI === "false") {
    return false;
  }
  return (
    SNAPZO_HUB_ADDRESS.length === 42 &&
    SNAPZO_SNAP_TOKEN_ADDRESS.length === 42 &&
    SNAPZO_HUB_ADDRESS.startsWith("0x") &&
    SNAPZO_SNAP_TOKEN_ADDRESS.startsWith("0x")
  );
}

/** True when a valid-looking SnapZoSocial proxy address is available (for future UI / relay). */
export function isSnapZoSocialConfigured(): boolean {
  return SNAPZO_SOCIAL_ADDRESS.length === 42 && SNAPZO_SOCIAL_ADDRESS.startsWith("0x");
}

/** True when a valid-looking SnapZoRewards contract address is available. */
export function isSnapZoRewardsConfigured(): boolean {
  return SNAPZO_REWARDS_ADDRESS.length === 42 && SNAPZO_REWARDS_ADDRESS.startsWith("0x");
}

/** True when a valid-looking SnapZoSubscriptions proxy address is available. */
export function isSnapZoSubscriptionsConfigured(): boolean {
  return (
    SNAPZO_SUBSCRIPTIONS_ADDRESS.length === 42 &&
    SNAPZO_SUBSCRIPTIONS_ADDRESS.startsWith("0x")
  );
}

export const snapZoHubAbi = [
  {
    type: "function",
    name: "depositWithSig",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "assets", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawWithSig",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "snapAmount", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "snapToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "earned",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "feeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function",
    name: "rewardContract",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

/** Hub `Withdraw` log — realized MUSD + net MEZO (after withdraw fee) per burn. */
export const snapZoHubWithdrawEventAbi = [
  {
    type: "event",
    name: "Withdraw",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "sharesBurned", type: "uint256", indexed: false },
      { name: "musdOut", type: "uint256", indexed: false },
      { name: "mezoOut", type: "uint256", indexed: false },
      { name: "relayer", type: "address", indexed: true },
    ],
  },
] as const;

/** Minimal ERC-20 view for SNAP `totalSupply()` (hub NAV ratio). */
export const erc20TotalSupplyAbi = [
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
