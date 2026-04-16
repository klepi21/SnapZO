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

interface ToastItem {
  id: string;
  message: string;
  variant: SnapzoToastVariant;
}

const ToastContext = createContext<
  ((message: string, variant?: SnapzoToastVariant) => void) | null
>(null);

const MAX_VISIBLE = 4;

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
    (message: string, variant: SnapzoToastVariant = "default") => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      const duration = variant === "error" ? 5600 : 3600;
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
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center px-4 pb-[calc(5.35rem+env(safe-area-inset-bottom,0px))]"
        aria-live="polite"
        aria-relevant="additions text"
      >
        <div className="pointer-events-none flex w-full max-w-[398px] flex-col items-stretch gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`snapzo-toast-enter pointer-events-auto rounded-2xl border px-4 py-3 text-center text-[13px] font-medium leading-snug tracking-[-0.01em] shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl ${
                t.variant === "error"
                  ? "border-red-500/30 bg-[rgba(48,12,16,0.92)] text-red-50"
                  : "border-white/[0.14] bg-[rgba(10,14,26,0.94)] text-zinc-100"
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useSnapzoToast() {
  const ctx = useContext(ToastContext);
  return ctx ?? (() => {});
}
