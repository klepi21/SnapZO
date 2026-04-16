import type { Address } from "viem";

/** Display decimals for MUSD (standard ERC-20; matches on-chain `decimals()`). */
export const MUSD_DECIMALS = 18;

/**
 * MUSD token on Mezo testnet (chain 31611).
 * Source: `deployments/matsnet/MUSD.json` in `@mezo-org/musd-contracts@1.1.0`.
 * Override if official Mezo docs list a different address.
 */
export const MUSD_ADDRESS_MEZO_TESTNET: Address = (process.env
  .NEXT_PUBLIC_MUSD_TOKEN_ADDRESS ?? "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503") as Address;

export const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const erc20TransferAbi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
