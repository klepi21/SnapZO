import type { Address } from "viem";

/**
 * Mezo testnet (31611) — latest deploy from `contracts/README.md`.
 * Override with `NEXT_PUBLIC_SNAPZO_HUB_ADDRESS` / `NEXT_PUBLIC_SNAP_TOKEN_ADDRESS` for other envs.
 */
const HUB_MEZO_TESTNET =
  "0x9Cd1C98aC5C4F68881dcC63Ded54Ddb239033BfD" as const;
const SNAP_MEZO_TESTNET =
  "0xCA1A5C01c533dDE957f0eFC79b25906b0187039D" as const;

function pickAddr(env: string | undefined, fallback: string): Address {
  const t = (env ?? "").trim();
  if (t.startsWith("0x") && t.length === 42) {
    return t as Address;
  }
  return fallback as Address;
}

/** UUPS proxy — EIP-712 `verifyingContract` and contract calls. */
export const SNAPZO_HUB_ADDRESS = pickAddr(
  process.env.NEXT_PUBLIC_SNAPZO_HUB_ADDRESS,
  HUB_MEZO_TESTNET,
);

export const SNAPZO_SNAP_TOKEN_ADDRESS = pickAddr(
  process.env.NEXT_PUBLIC_SNAP_TOKEN_ADDRESS,
  SNAP_MEZO_TESTNET,
);

/** SNAP is standard ERC-20 (18 decimals) — hub-minted receipt for pooled MUSD. */
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
] as const;

/** Hub `Withdraw` log — use for realized MUSD per SNAP when vault previews revert. */
export const snapZoHubWithdrawEventAbi = [
  {
    type: "event",
    name: "Withdraw",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "sharesBurned", type: "uint256", indexed: false },
      { name: "musdOut", type: "uint256", indexed: false },
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
