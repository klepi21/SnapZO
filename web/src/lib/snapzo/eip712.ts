import type { Address } from "viem";

import { mezoTestnet } from "@/lib/chains/mezo-testnet";

export const SNAPZO_EIP712 = {
  domainName: "SnapZoHub",
  domainVersion: "1",
} as const;

/** EIP-712 domain for both `Deposit` and `Withdraw` primary types on `SnapZoHub`. */
export function snapZoHubDomain(verifyingContract: Address) {
  return {
    name: SNAPZO_EIP712.domainName,
    version: SNAPZO_EIP712.domainVersion,
    chainId: BigInt(mezoTestnet.id),
    verifyingContract,
  } as const;
}

/** Must match `DEPOSIT_TYPEHASH` in `SnapZoHub.sol`. */
export const snapZoDepositTypes = {
  Deposit: [
    { name: "user", type: "address" },
    { name: "assets", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/** Must match `WITHDRAW_TYPEHASH` in `SnapZoHub.sol`. */
export const snapZoWithdrawTypes = {
  Withdraw: [
    { name: "user", type: "address" },
    { name: "snapAmount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;
