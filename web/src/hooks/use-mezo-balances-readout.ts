import { useAccount, useBalance, useChainId, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { mezoTestnet } from "@/lib/chains/mezo-testnet";
import {
  erc20BalanceAbi,
  MUSD_ADDRESS_MEZO_TESTNET,
  MUSD_DECIMALS,
} from "@/lib/constants/musd";
import { formatTokenAmountDisplay } from "@/lib/format-token-amount";

export function useMezoBalancesReadout() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onMezoTestnet = chainId === mezoTestnet.id;

  const native = useBalance({
    address,
    chainId: mezoTestnet.id,
    query: {
      enabled: Boolean(isConnected && address && onMezoTestnet),
    },
  });

  const musdBalance = useReadContract({
    chainId: mezoTestnet.id,
    address: MUSD_ADDRESS_MEZO_TESTNET,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(isConnected && address && onMezoTestnet),
    },
  });

  const musdFormatted =
    musdBalance.data !== undefined
      ? formatTokenAmountDisplay(
          formatUnits(musdBalance.data, MUSD_DECIMALS),
          6,
        )
      : null;

  const btcFormatted = native.data?.formatted
    ? formatTokenAmountDisplay(native.data.formatted, 8)
    : null;

  return {
    address,
    isConnected,
    onMezoTestnet,
    native,
    musdBalance,
    btcFormatted,
    musdFormatted,
  };
}

