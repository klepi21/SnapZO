import type { Address } from "viem";
import { MUSD_ADDRESS_MEZO_TESTNET } from "@/lib/constants/musd";

/**
 * Mezo testnet DEX — values taken from a successful on-chain swap tx:
 * https://explorer.test.mezo.org/tx/0x22d0d5083ca9a7577c22174d0b3ebc0a133935fc9846a35c6a7e5ab27e606c8b
 *
 * Flow: ERC-20 “BTC” at `MEZO_BTC_ERC20` → MUSD via `MEZO_SWAP_ROUTER` using a single hop
 * `(BTC, MUSD, stable=false, factory)`.
 */
export const MEZO_SWAP_ROUTER: Address =
  "0xd245bec6836d85e159763a5d2bfce7cbc3488e03";

/** Wrapped / synthetic BTC token used by the router (18 decimals on-chain). */
export const MEZO_BTC_ERC20: Address =
  "0x7b7c000000000000000000000000000000000000";

export const MEZO_DEX_FACTORY: Address =
  "0x4947243cc818b627a5d06d14c4ece7398a23ce1a";

export const MEZO_DEX_TOKEN_DECIMALS = 18 as const;

export const mezoSwapRouterAbi = [
  {
    type: "function",
    name: "getAmountsOut",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      {
        name: "routes",
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "stable", type: "bool" },
          { name: "factory", type: "address" },
        ],
      },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "swapExactTokensForTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      {
        name: "routes",
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "stable", type: "bool" },
          { name: "factory", type: "address" },
        ],
      },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amount", type: "uint256" }],
  },
] as const;

export const erc20AllowanceAbi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const erc20ApproveAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function swapRouteBtcToMusd() {
  return [
    {
      from: MEZO_BTC_ERC20,
      to: MUSD_ADDRESS_MEZO_TESTNET,
      stable: false,
      factory: MEZO_DEX_FACTORY,
    },
  ] as const;
}

export function swapRouteMusdToBtc() {
  return [
    {
      from: MUSD_ADDRESS_MEZO_TESTNET,
      to: MEZO_BTC_ERC20,
      stable: false,
      factory: MEZO_DEX_FACTORY,
    },
  ] as const;
}
