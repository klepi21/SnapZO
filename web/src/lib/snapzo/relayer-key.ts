/**
 * Normalize `RELAYER_PRIVATE_KEY` for viem (hex string with `0x` prefix).
 * Server-only — do not import from client components.
 */
export function normalizeRelayerPrivateKey(raw: string | undefined): `0x${string}` | null {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const t = raw.trim();
  if (t.length === 0) {
    return null;
  }
  const with0x = t.startsWith("0x") ? t : `0x${t}`;
  if (with0x.length !== 66) {
    return null;
  }
  return with0x as `0x${string}`;
}
