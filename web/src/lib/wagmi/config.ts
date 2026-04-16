import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { mezoTestnet } from "@/lib/chains/mezo-testnet";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

/**
 * WalletConnect (Reown) requires localhost in the project allowlist, or the
 * modal shows an origin error. For local dev we default to **injected-only**
 * wallets (MetaMask, Rabby, etc.) so you can work without Reown domain setup.
 *
 * Set `NEXT_PUBLIC_ENABLE_WALLETCONNECT=true` and a real
 * `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` after allowlisting this origin on
 * cloud.reown.com.
 */
const walletConnectEnabled =
  process.env.NEXT_PUBLIC_ENABLE_WALLETCONNECT === "true" &&
  Boolean(walletConnectProjectId);

const wallets = walletConnectEnabled
  ? [
      {
        groupName: "Recommended",
        wallets: [metaMaskWallet, injectedWallet, walletConnectWallet],
      },
    ]
  : [
      {
        groupName: "Browser",
        wallets: [metaMaskWallet, injectedWallet],
      },
    ];

export const wagmiConfig = getDefaultConfig({
  appName: "SnapZo",
  projectId: walletConnectProjectId || "00000000000000000000000000000000",
  chains: [mezoTestnet],
  wallets,
  ssr: true,
});
