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

export interface FeedItem {
  id: string;
  postId: string;
  socialPostId?: number | null;
  creatorWallet: string;
  content?: string;
  ipfsHash?: string;
  isLocked: boolean;
  unlockPrice: number;
  blurImage?: string;
  totalTips?: number;
  createdAt: string;
  unlockedByMe?: boolean;
  tipCount?: number;
  replyCount?: number;
  commentCount?: number;
  latestInteractionAt?: string;
  creatorDisplayName?: string | null;
  creatorUsername?: string | null;
  creatorProfileImage?: string | null;
}

export interface FeedResponse {
  items: FeedItem[];
  nextCursor: string | null;
}

export interface SocialReplyItem {
  id: string;
  post: string;
  requestId: string;
  socialPostId: string;
  requesterWallet: string;
  creatorWallet: string;
  stakeAmountWei: string;
  requestTxHash: string;
  requesterComment: string;
  status: "pending" | "responded" | "refunded";
  creatorReply?: string;
  commentId?: string;
  fulfillTxHash?: string;
  refundTxHash?: string;
  requesterDisplayName?: string | null;
  requesterUsername?: string | null;
  requesterProfileImage?: string | null;
  creatorDisplayName?: string | null;
  creatorUsername?: string | null;
  creatorProfileImage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TipItem {
  id: string;
  fromWallet: string;
  amount: number;
  txHash: string;
  createdAt: string;
  tipperDisplayName?: string | null;
  tipperUsername?: string | null;
  tipperProfileImage?: string | null;
}

export type AdminActivityTable = "likes" | "replies" | "unlocks" | "users" | "activity";

export interface AdminActivityResponse {
  table: AdminActivityTable;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: {
    likes: number;
    replies: number;
    unlocks: number;
    users: number;
    posts: number;
  };
  items: Array<Record<string, unknown>>;
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

export async function fetchFeed(
  params?: { viewer?: string; limit?: number; cursor?: string },
  signal?: AbortSignal,
): Promise<FeedResponse> {
  const url = new URL(`${getSnapzoApiBaseUrl()}/api/feed`);
  if (params?.viewer) url.searchParams.set("viewer", params.viewer);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  if (params?.cursor) url.searchParams.set("cursor", params.cursor);

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchFeed failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as FeedResponse;
}

export async function fetchSocialRepliesForPost(
  postObjectId: string,
  signal?: AbortSignal
): Promise<{ items: SocialReplyItem[] }> {
  const res = await fetch(
    `${getSnapzoApiBaseUrl()}/api/social-reply/post/${postObjectId}`,
    { signal }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `fetchSocialRepliesForPost failed (${res.status}): ${text || res.statusText}`
    );
  }
  return (await res.json()) as { items: SocialReplyItem[] };
}

export async function createSocialReplyRequestRecord(input: {
  postObjectId: string;
  requestId: string;
  socialPostId: string;
  requesterWallet: string;
  creatorWallet: string;
  stakeAmountWei: string;
  requestTxHash: string;
  requesterComment: string;
}): Promise<SocialReplyItem> {
  const res = await fetch(`${getSnapzoApiBaseUrl()}/api/social-reply/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `createSocialReplyRequestRecord failed (${res.status}): ${text || res.statusText}`
    );
  }
  return (await res.json()) as SocialReplyItem;
}

export async function fulfillSocialReplyRecord(input: {
  requestId: string;
  creatorWallet: string;
  creatorReply: string;
  commentId: string;
  fulfillTxHash: string;
}): Promise<SocialReplyItem> {
  const res = await fetch(`${getSnapzoApiBaseUrl()}/api/social-reply/fulfill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `fulfillSocialReplyRecord failed (${res.status}): ${text || res.statusText}`
    );
  }
  return (await res.json()) as SocialReplyItem;
}

export async function fetchTipsForPost(
  postObjectId: string,
  viewer?: string,
  signal?: AbortSignal
): Promise<{ items: TipItem[]; hasViewerTipped: boolean }> {
  const url = new URL(`${getSnapzoApiBaseUrl()}/api/tip/post/${postObjectId}`);
  if (viewer) url.searchParams.set("viewer", viewer);
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchTipsForPost failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as { items: TipItem[]; hasViewerTipped: boolean };
}

export async function createTipRecord(input: {
  postId: string;
  fromWallet: string;
  amount: number;
  txHash: string;
  message?: string;
}): Promise<void> {
  const res = await fetch(`${getSnapzoApiBaseUrl()}/api/tip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`createTipRecord failed (${res.status}): ${text || res.statusText}`);
  }
}

export async function createSocialUnlockRecord(input: {
  postObjectId: string;
  userWallet: string;
  txHash: string;
  amountWei: string;
}): Promise<void> {
  const res = await fetch(`${getSnapzoApiBaseUrl()}/api/social-unlock/record`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`createSocialUnlockRecord failed (${res.status}): ${text || res.statusText}`);
  }
}

export async function fetchAdminActivityTable(
  table: AdminActivityTable,
  params?: { page?: number; pageSize?: number },
  signal?: AbortSignal
): Promise<AdminActivityResponse> {
  const url = new URL(`${getSnapzoApiBaseUrl()}/api/admin/activity`);
  url.searchParams.set("table", table);
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `fetchAdminActivityTable failed (${res.status}): ${text || res.statusText}`
    );
  }
  return (await res.json()) as AdminActivityResponse;
}
