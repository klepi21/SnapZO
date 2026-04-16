const PROFILE_KEY = "snapzo-profile-v1";

export interface SnapzoProfileLocal {
  displayName: string;
  /** Without leading @; shown as @username */
  username: string;
  bio: string;
  /** JPEG data URL or null to use default avatar seed */
  avatarDataUrl: string | null;
}

export function defaultSnapzoProfile(): SnapzoProfileLocal {
  return {
    displayName: "Nazmul Rahman",
    username: "nazmul009878",
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
        typeof p.displayName === "string" && p.displayName.trim()
          ? p.displayName.trim().slice(0, 64)
          : d.displayName,
      username:
        typeof p.username === "string" && p.username.trim()
          ? sanitizeUsername(p.username)
          : d.username,
      bio:
        typeof p.bio === "string" ? p.bio.trim().slice(0, 280) : d.bio,
      avatarDataUrl:
        typeof p.avatarDataUrl === "string" && p.avatarDataUrl.startsWith("data:")
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
  const cleaned = s.replace(/[^a-z0-9_]/g, "").slice(0, 30);
  return cleaned || "user";
}
