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
