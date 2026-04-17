"use client";

import { HelpCircle } from "lucide-react";
import { useId, type ReactNode } from "react";

type HelpPopoverProps = {
  /** Accessible name for the trigger (e.g. "How estimates work"). */
  label: string;
  children: ReactNode;
  /** Smaller trigger for tight rows (e.g. card headers). */
  size?: "default" | "sm";
};

/**
 * Native Popover API — tap/click the trigger to open; light-dismiss outside.
 * Keeps dense Earn copy out of the main layout.
 */
export function HelpPopover({ label, children, size = "default" }: HelpPopoverProps) {
  const raw = useId().replace(/:/g, "");
  const popoverId = `snapzo-help-${raw}`;
  const btn =
    size === "sm"
      ? "h-7 w-7 rounded-md border border-white/10 bg-white/[0.03] text-zinc-500 hover:border-sky-500/30 hover:bg-sky-500/10 hover:text-sky-200/95"
      : "h-8 w-8 rounded-full border border-white/12 bg-white/[0.04] text-zinc-400 hover:border-sky-500/35 hover:bg-sky-500/10 hover:text-sky-200";

  return (
    <>
      <button
        type="button"
        popoverTarget={popoverId}
        className={`inline-flex shrink-0 items-center justify-center transition ${btn}`}
        aria-label={label}
      >
        <HelpCircle className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} aria-hidden />
      </button>
      <div
        id={popoverId}
        popover="auto"
        className="fixed left-1/2 top-[14%] z-[200] m-0 max-h-[min(72vh,26rem)] w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-y-auto rounded-2xl border border-white/15 bg-zinc-950/98 p-4 text-left text-[13px] leading-relaxed text-zinc-300 shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl"
      >
        <div className="space-y-2.5 [&_p]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-zinc-100">
          {children}
        </div>
      </div>
    </>
  );
}
