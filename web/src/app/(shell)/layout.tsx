import { AppHeader } from "@/components/momento/app-header";
import { BottomNav } from "@/components/momento/bottom-nav";
import { SnapzoToastProvider } from "@/components/providers/snapzo-toast-provider";
import {
  SHELL_GUTTER_CLASS,
  SNAPZO_SCROLL_SURFACE_CLASS,
} from "@/lib/shell-background";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex min-h-dvh justify-center text-zinc-100 ${SHELL_GUTTER_CLASS}`}
    >
      <div
        className={`relative min-h-dvh w-full max-w-[430px] overflow-x-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_70px_rgba(0,0,0,0.45)] ${SNAPZO_SCROLL_SURFACE_CLASS}`}
      >
        <SnapzoToastProvider>
          <AppHeader />
          {children}
          <BottomNav />
        </SnapzoToastProvider>
      </div>
    </div>
  );
}
