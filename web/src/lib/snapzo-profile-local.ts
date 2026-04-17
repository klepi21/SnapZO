const PROFILE_KEY = "snapzo-profile-v1";

/** Fired after the local profile is hydrated from the backend. */
export const SNAPZO_PROFILE_HYDRATED_EVENT = "snapzo:profile-hydrated";

export interface SnapzoProfileLocal {
  displayName: string;
  /** Without leading @; shown as @username */
  username: string;
  bio: string;
  /**
   * Either a JPEG `data:` URL (locally picked image) or an `https://` URL
   * pointing at an IPFS gateway (rehydrated from backend CID). `null` when
   * no avatar has been set.
   */
  avatarDataUrl: string | null;
}

export function defaultSnapzoProfile(): SnapzoProfileLocal {
  return {
    displayName: "",
    username: "",
    bio: "",
    avatarDataUrl: null,
  };
}


export function readSnapzoProfile(): SnapzoProfileLocal {
  if (typeof window === "undefined") {
    return defaultSnapzoProfile();
  }
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) {
      return defaultSnapzoProfile();
    }
    const p = JSON.parse(raw) as Partial<SnapzoProfileLocal>;
    const d = defaultSnapzoProfile();
    return {
      displayName:
        typeof p.displayName === "string" ? p.displayName.trim().slice(0, 64) : d.displayName,
      username:
        typeof p.username === "string" ? sanitizeUsername(p.username) : d.username,
      bio:
        typeof p.bio === "string" ? p.bio.trim().slice(0, 280) : d.bio,
      avatarDataUrl:
        typeof p.avatarDataUrl === "string" &&
        (p.avatarDataUrl.startsWith("data:") ||
          p.avatarDataUrl.startsWith("http://") ||
          p.avatarDataUrl.startsWith("https://"))
          ? p.avatarDataUrl
          : null,
    };
  } catch {
    return defaultSnapzoProfile();
  }
}

export function persistSnapzoProfile(p: SnapzoProfileLocal): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        displayName: p.displayName.trim().slice(0, 64),
        username: sanitizeUsername(p.username),
        bio: p.bio.trim().slice(0, 280),
        avatarDataUrl: p.avatarDataUrl,
      }),
    );
  } catch {
    // quota exceeded etc.
  }
}

export function sanitizeUsername(raw: string): string {
  const s = raw.trim().replace(/^@+/, "").toLowerCase();
  return s.replace(/[^a-z0-9_]/g, "").slice(0, 30);
}

/** Minimal backend shape we care about when hydrating. */
interface BackendUserShape {
  displayName?: string | null;
  username?: string | null;
  bio?: string | null;
  /** IPFS CID returned by the backend. */
  profileImage?: string | null;
}

/** Build a public IPFS gateway URL from a CID. */
export function ipfsGatewayUrl(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

/**
 * Merge backend user data into localStorage. Backend wins over local for
 * any field it has a value for; fields the backend has not set keep their
 * local value (so in-progress drafts aren't lost).
 *
 * Fires a window event so already-mounted UI (e.g. ProfileView) can
 * re-read without a full reload.
 */
export function hydrateLocalProfileFromBackend(user: BackendUserShape): void {
  if (typeof window === "undefined") return;

  const existing = readSnapzoProfile();

  const merged: SnapzoProfileLocal = {
    displayName:
      typeof user.displayName === "string"
        ? user.displayName
        : existing.displayName,
    username:
      typeof user.username === "string" ? user.username : existing.username,
    bio: typeof user.bio === "string" ? user.bio : existing.bio,
    avatarDataUrl:
      typeof user.profileImage === "string" && user.profileImage.trim()
        ? ipfsGatewayUrl(user.profileImage.trim())
        : existing.avatarDataUrl,
  };

  persistSnapzoProfile(merged);
  window.dispatchEvent(new CustomEvent(SNAPZO_PROFILE_HYDRATED_EVENT));
}
