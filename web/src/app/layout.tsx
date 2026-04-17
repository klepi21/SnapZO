import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import { SHELL_GUTTER_CLASS } from "@/lib/shell-background";
import { Web3Provider } from "@/components/providers/web3-provider";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SnapZO · The Social-Fi Yield Engine for Mezo",
  description:
    "SnapZO turns social engagement into automated yield on Mezo testnet: deposit MUSD to mint yield-bearing SNAP shares, earn MUSD + MEZO rewards, and move through gasless EIP-712 relayers.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#141a28",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className={`min-h-dvh font-sans antialiased ${SHELL_GUTTER_CLASS}`}>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
