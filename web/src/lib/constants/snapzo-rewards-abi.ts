/**
 * SnapZoRewards (Merkle distributor) admin + user reads/writes.
 * Matches `contracts/src/SnapZoRewards.sol`.
 */
export const snapZoRewardsAbi = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "rewardToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "relayer", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "roots",
    stateMutability: "view",
    inputs: [{ name: "cycle", type: "uint256" }],
    outputs: [{ type: "bytes32" }],
  },
  { type: "function", name: "lastUpdateTimestamp", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "hasClaimed",
    stateMutability: "view",
    inputs: [
      { name: "cycle", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ type: "bool" }],
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
    name: "updateRoot",
    stateMutability: "nonpayable",
    inputs: [
      { name: "cycle", type: "uint256" },
      { name: "root", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "cycle", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [],
  },
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

