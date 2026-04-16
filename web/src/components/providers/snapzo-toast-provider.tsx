"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { clearLegacyUnlockStorage } from "@/lib/snapzo-local";

export type SnapzoToastVariant = "default" | "error";

/** Plain string, or a compact layout with optional explorer link (tap-friendly). */
export type SnapzoToastMessage =
  | string
  | {
      title: string;
      subtitle?: string;
      link?: { href: string; label: string };
    };

interface ToastItem {
  id: string;
  message: SnapzoToastMessage;
  variant: SnapzoToastVariant;
}

const ToastContext = createContext<
  ((message: SnapzoToastMessage, variant?: SnapzoToastVariant) => void) | null
>(null);

const MAX_VISIBLE = 4;

function toastDuration(
  message: SnapzoToastMessage,
  variant: SnapzoToastVariant,
) {
  if (variant === "error") {
    return 5800;
  }
  if (typeof message === "object" && message.link) {
    return 9000;
  }
  return 3800;
}

function ToastBody({ message }: { message: SnapzoToastMessage }) {
  if (typeof message === "string") {
    return (
      <p className="text-center text-[13px] font-medium leading-snug tracking-[-0.01em]">
        {message}
      </p>
    );
  }
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 text-left">
      <p className="text-[13px] font-semibold leading-snug tracking-[-0.01em] text-zinc-50">
        {message.title}
      </p>
      {message.subtitle ? (
        <p className="text-[12px] font-normal leading-snug text-zinc-400">
          {message.subtitle}
        </p>
      ) : null}
      {message.link ? (
        <a
          href={message.link.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-white/[0.08] px-3 py-2.5 text-center text-[12px] font-semibold text-sky-300 ring-1 ring-sky-500/35 transition hover:bg-white/[0.12] hover:text-sky-200 active:scale-[0.99]"
        >
          {message.link.label}
        </a>
      ) : null}
    </div>
  );
}

export function SnapzoToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    clearLegacyUnlockStorage();
  }, []);

  const showToast = useCallback(
    (message: SnapzoToastMessage, variant: SnapzoToastVariant = "default") => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      const duration = toastDuration(message, variant);
      setToasts((prev) =>
        [...prev, { id, message, variant }].slice(-MAX_VISIBLE),
      );
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    [],
  );

  const value = useMemo(() => showToast, [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center px-3 pb-[calc(5.15rem+env(safe-area-inset-bottom,0px))] sm:px-4"
        aria-live="polite"
        aria-relevant="additions text"
      >
        <div className="pointer-events-none flex w-full max-w-[398px] flex-col items-stretch gap-2.5">
          {toasts.map((t) => {
            const isRich = typeof t.message !== "string";
            return (
              <div
                key={t.id}
                className={`snapzo-toast-enter pointer-events-auto w-full min-w-0 rounded-2xl border px-3.5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-4 sm:py-3.5 ${
                  isRich ? "text-left" : "text-center"
                } ${
                  t.variant === "error"
                    ? "border-red-500/30 bg-[rgba(48,12,16,0.92)] text-red-50"
                    : "border-white/[0.14] bg-[rgba(10,14,26,0.94)] text-zinc-100"
                }`}
              >
                <ToastBody message={t.message} />
              </div>
            );
          })}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useSnapzoToast() {
  const ctx = useContext(ToastContext);
  return ctx ?? (() => {});
}
