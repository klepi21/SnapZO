import type { Address } from "viem";

/**
 * MUSD vault + sMUSD gauge on Mezo testnet — decoded from:
 * - Deposit MUSD → mint sMUSD: https://explorer.test.mezo.org/tx/0xb1cb7c8f8c7c745ba403fe741755f57a209266b717bc098a85c702d9b2ee15e5
 * - Stake sMUSD in gauge: https://explorer.test.mezo.org/tx/0x06802b6ea45d17fdbaa2d8a1769d1c06fa172d7f6f4ab45200dbcc0174785023
 *
 * Flow: approve MUSD → `MEZO_MUSD_VAULT.deposit(uint256)` (receive sMUSD shares at the vault ERC-20).
 * Then approve sMUSD (vault token) → `MEZO_SMUSD_GAUGE.deposit(uint256,address)` to stake.
 * Unstake: `gauge.withdraw(uint256)`. Redeem MUSD: `vault.withdraw(uint256)` (requires sMUSD in wallet).
 */
export const MEZO_MUSD_VAULT: Address =
  "0x6f461c68b2c5492c0f5ccec5a264d692aa7a8e16";

export const MEZO_SMUSD_GAUGE: Address =
  "0xa6972f35550717280f2538ea77638b29073e3f07";

/**
 * Gauge emissions token: `MEZO_SMUSD_GAUGE.rewardToken()` on testnet (not the same as
 * `MEZO_BTC_ERC20` in `mezo-dex.ts`, which ends in `…0000`).
 */
export const MEZO_SMUSD_GAUGE_REWARD_TOKEN: Address =
  "0x7B7c000000000000000000000000000000000001";

export const mezoMusdVaultAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "previewRedeem",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "convertToAssets",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "convertToShares",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const mezoSmusdGaugeAbi = [
  {
    type: "function",
    name: "rewardToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "stakingToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
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
    name: "getReward",
    stateMutability: "nonpayable",
    /** Parameterless `getReward()` reverts on this gauge; use `getReward(account)` (see https://explorer.test.mezo.org/tx/0x34c4bc1f156eacbaccf5d235ebc2ba7ca5753ba2bdbbd2107a771c2c6c81bdb8 ). */
    inputs: [{ name: "account", type: "address" }],
    outputs: [],
  },
] as const;
