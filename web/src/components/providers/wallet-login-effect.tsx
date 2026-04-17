"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";

import { loginWallet } from "@/lib/snapzo-api";
import { hydrateLocalProfileFromBackend } from "@/lib/snapzo-profile-local";

/**
 * Fires `POST /api/auth/login` whenever a new wallet address becomes
 * connected. The backend endpoint is idempotent, so calling it again for
 * the same address is harmless; we still dedupe in-memory per mount to
 * avoid unnecessary network calls (e.g. on re-renders).
 *
 * Placed inside the authenticated shell so it only runs where the user
 * actually starts using the app (not on marketing / onboarding pages).
 */
export function WalletLoginEffect() {
  const { address, isConnected } = useAccount();
  const loggedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isConnected || !address) return;
    const normalized = address.toLowerCase();
    if (loggedRef.current.has(normalized)) return;

    const controller = new AbortController();
    loggedRef.current.add(normalized);

    loginWallet(address, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        // Backend is source of truth — hydrate localStorage so profile
        // data survives cache clears / new browsers.
        hydrateLocalProfileFromBackend(res.user);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // Drop from dedupe set so a manual reconnect retries.
        loggedRef.current.delete(normalized);
        // eslint-disable-next-line no-console
        console.warn("[snapzo] wallet login failed", err);
      });

    return () => {
      controller.abort();
    };
  }, [address, isConnected]);

  return null;
}
