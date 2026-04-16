/** Legacy key — removed from app logic; cleared on load so demos always start locked. */
const LEGACY_UNLOCK_KEY = "snapzo-unlocked-posts";

const LIKED_KEY = "snapzo-liked-posts";
const COMMENTS_KEY = "snapzo-comments";

export function clearLegacyUnlockStorage() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(LEGACY_UNLOCK_KEY);
  } catch {
    // ignore
  }
}

function readJsonIds(key: string): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function isPostLikedInStorage(postId: string): boolean {
  return readJsonIds(LIKED_KEY).has(postId);
}

export function persistPostLiked(postId: string) {
  if (typeof window === "undefined") {
    return;
  }
  const s = readJsonIds(LIKED_KEY);
  s.add(postId);
  window.localStorage.setItem(LIKED_KEY, JSON.stringify([...s]));
}

export interface StoredComment {
  id: string;
  text: string;
  txHash: `0x${string}`;
  at: number;
}

export function readCommentsForPost(postId: string): StoredComment[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(COMMENTS_KEY);
    if (!raw) {
      return [];
    }
    const all = JSON.parse(raw) as Record<string, StoredComment[]>;
    return Array.isArray(all[postId]) ? all[postId] : [];
  } catch {
    return [];
  }
}

export function appendCommentForPost(postId: string, comment: StoredComment) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const raw = window.localStorage.getItem(COMMENTS_KEY);
    const all: Record<string, StoredComment[]> = raw
      ? (JSON.parse(raw) as Record<string, StoredComment[]>)
      : {};
    const prev = Array.isArray(all[postId]) ? all[postId] : [];
    all[postId] = [...prev, comment];
    window.localStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
  } catch {
    // ignore quota / parse errors
  }
}
