/**
 * SnapZoHub admin + config reads/writes (UUPS proxy).
 * Matches `contracts/src/SnapZoHub.sol`.
 */
export const snapZoHubAdminAbi = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "feeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "feeReceiver", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "musd", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "vault", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "gauge", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "router", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "rewardToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "snapToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "isRelayer",
    stateMutability: "view",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "setRelayer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "relayer", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setFee",
    stateMutability: "nonpayable",
    inputs: [
      { name: "feeBps_", type: "uint16" },
      { name: "feeReceiver_", type: "address" },
    ],
    outputs: [],
  },
  { type: "function", name: "pause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "unpause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "harvest", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "restake", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "injectMusdWithoutMint",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "recoverRewardToken",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "sweep",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setIntegrations",
    stateMutability: "nonpayable",
    inputs: [
      { name: "musd_", type: "address" },
      { name: "vault_", type: "address" },
      { name: "gauge_", type: "address" },
      { name: "router_", type: "address" },
      { name: "rewardToken_", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setRestakeRoutes",
    stateMutability: "nonpayable",
    inputs: [{ name: "encodedRoutes", type: "bytes" }],
    outputs: [],
  },
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;
