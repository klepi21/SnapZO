import { SnapzoToastProvider } from "@/components/providers/snapzo-toast-provider";
import { WalletLoginEffect } from "@/components/providers/wallet-login-effect";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh px-3 py-4 text-zinc-100 sm:px-5 sm:py-6">
      <SnapzoToastProvider>
        <WalletLoginEffect />
        {children}
      </SnapzoToastProvider>
    </div>
  );
}
