/**
 * Base URL for the SnapZO Express API (see `backend/`).
 * Defaults to local dev server port from backend config.
 */
export function getSnapzoApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SNAPZO_API_URL?.trim();
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  return "http://127.0.0.1:4000";
}

export interface SnapzoBackendUser {
  id: string;
  walletAddress: string;
  displayName?: string | null;
  username?: string | null;
  bio?: string | null;
  profileImage?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface LoginResponse {
  user: SnapzoBackendUser;
  isNew: boolean;
}

/**
 * Idempotent "login" — creates the user row on first call, returns the
 * existing user on subsequent calls. Never overwrites profile fields.
 */
export async function loginWallet(
  walletAddress: string,
  signal?: AbortSignal,
): Promise<LoginResponse> {
  const res = await fetch(`${getSnapzoApiBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `loginWallet failed (${res.status}): ${text || res.statusText}`,
    );
  }
  return (await res.json()) as LoginResponse;
}

export interface UpdateProfilePayload {
  displayName?: string | null;
  username?: string | null;
  bio?: string | null;
  /** Base64 string or `data:image/...;base64,...` data URL. */
  avatarBase64?: string | null;
  avatarMimeType?: string;
  avatarName?: string;
}

/**
 * PATCH /api/user/:wallet — partial profile update. Any field not in the
 * payload is left untouched. Pass `null` to clear a field.
 */
export async function updateProfile(
  walletAddress: string,
  payload: UpdateProfilePayload,
  signal?: AbortSignal,
): Promise<SnapzoBackendUser> {
  const res = await fetch(
    `${getSnapzoApiBaseUrl()}/api/user/${walletAddress}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `updateProfile failed (${res.status}): ${text || res.statusText}`,
    );
  }
  return (await res.json()) as SnapzoBackendUser;
}
