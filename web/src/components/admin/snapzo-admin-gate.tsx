"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getAddress } from "viem";
import { useAccount } from "wagmi";

const SNAPZO_ADMIN_WALLET = getAddress("0xE5f3e81f3045865EB140fCC44038433891D0e25f");

export function SnapZoAdminGate({ children }: { children: React.ReactNode }) {
  const { address, isConnected, isConnecting } = useAccount();

  if (isConnecting)
    return (
      <main className="mx-auto flex min-h-[50vh] w-full max-w-[980px] items-center justify-center px-4 py-12">
        <p className="text-sm text-zinc-400">Checking admin access…</p>
      </main>
    );

  const isAllowed =
    Boolean(isConnected && address) &&
    getAddress(address as `0x${string}`) === SNAPZO_ADMIN_WALLET;

  if (isAllowed) {
    return <>{children}</>;
  }

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[980px] items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-center">
        <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-300/30 bg-red-500/20">
          <ShieldAlert className="h-5 w-5 text-red-200" />
        </div>
        <h1 className="text-base font-semibold text-red-100">Admin access only</h1>
        <p className="mt-2 text-sm leading-relaxed text-red-100/85">
          This page is restricted to the SnapZo admin wallet.
        </p>
        <Link
          href="/feed"
          className="snapzo-pressable mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15"
        >
          Back to feed
        </Link>
      </section>
    </main>
  );
}
