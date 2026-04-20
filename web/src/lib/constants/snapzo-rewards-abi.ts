/**
 * SnapZoCreators (claim-only distributor) admin + user reads/writes.
 * Matches `contracts/src/SnapZoCreators.sol`.
 */
export const snapZoRewardsAbi = [
  { type: "function", name: "MAX_BPS", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "rewardToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "relayer", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "lastUpdateTimestamp", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "claimable",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "claimed",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "setRelayer",
    stateMutability: "nonpayable",
    inputs: [{ name: "relayer_", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setAllocations",
    stateMutability: "nonpayable",
    inputs: [
      { name: "users", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "reset", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setAllocationsByBps",
    stateMutability: "nonpayable",
    inputs: [
      { name: "users", type: "address[]" },
      { name: "bps", type: "uint256[]" },
      { name: "poolAmount", type: "uint256" },
      { name: "reset", type: "bool" },
    ],
    outputs: [],
  },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "withdrawUnclaimed",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  { type: "function", name: "pause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "unpause", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

