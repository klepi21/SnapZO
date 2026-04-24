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

export interface UserPostItem {
  id: string;
  postId: string;
  creatorWallet: string;
  content?: string;
  ipfsHash?: string;
  visibility?: "public" | "unlock" | "subscriber_only";
  subscriberOnlyLocked?: boolean;
  isLocked: boolean;
  unlockPrice: number;
  blurImage?: string;
  totalTips?: number;
  likeCount?: number;
  replyCount?: number;
  unlockCount?: number;
  unlockEarnings?: number;
  createdAt: string;
}

export interface UserProfileWithPostsResponse {
  user: SnapzoBackendUser;
  posts: UserPostItem[];
}

export interface OnlySnapsPlanResponse {
  creatorWallet: string;
  monthlyPriceWei: string | null;
  updatedAt: string | null;
  updatedTxHash: string | null;
}

export interface OnlySnapsStatusResponse {
  creatorWallet: string;
  viewerWallet: string;
  monthlyPriceWei: string | null;
  expiresAt: string | null;
  isActive: boolean;
  activeSubscribers: number;
}

export interface StoryFeedItem {
  creatorWallet: string;
  creatorDisplayName: string | null;
  creatorUsername: string | null;
  creatorProfileImage: string | null;
  hasUnseen: boolean;
  latestCreatedAt: string;
  stories: Array<{
    id: string;
    ipfsHash: string;
    createdAt: string;
    expiresAt: string;
    seen: boolean;
  }>;
}

export interface StoriesFeedResponse {
  items: StoryFeedItem[];
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
  visibility?: "public" | "unlock" | "subscriber_only";
  subscriberOnlyLocked?: boolean;
  isLocked: boolean;
  unlockPrice: number;
  blurImage?: string;
  totalTips?: number;
  createdAt: string;
  unlockedByMe?: boolean;
  tipCount?: number;
  replyCount?: number;
  commentCount?: number;
  unlockCount?: number;
  latestInteractionAt?: string;
  creatorDisplayName?: string | null;
  creatorUsername?: string | null;
  creatorProfileImage?: string | null;
}

export interface FeedResponse {
  items: FeedItem[];
  nextCursor: string | null;
}

export interface PostDetailResponse {
  id: string;
  postId: string;
  creatorWallet: string;
  content?: string;
  ipfsHash?: string;
  visibility?: "public" | "unlock" | "subscriber_only";
  subscriberOnlyLocked?: boolean;
  isLocked: boolean;
  unlockPrice: number;
  blurImage?: string;
  totalTips?: number;
  createdAt: string;
  unlockedByMe?: boolean;
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

export type AdminActivityTable =
  | "likes"
  | "replies"
  | "unlocks"
  | "users"
  | "activity"
  | "posts"
  | "subscriptions";

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
    onlySnapsPlans?: number;
    onlySnapsActive?: number;
    onlySnapsRecords?: number;
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

export async function fetchUserProfileWithPosts(
  walletAddress: string,
  viewerWallet?: string,
  signal?: AbortSignal
): Promise<UserProfileWithPostsResponse> {
  const url = new URL(`${getSnapzoApiBaseUrl()}/api/user/${walletAddress}`);
  if (viewerWallet) {
    url.searchParams.set("viewer", viewerWallet);
  }
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `fetchUserProfileWithPosts failed (${res.status}): ${text || res.statusText}`
    );
  }
  return (await res.json()) as UserProfileWithPostsResponse;
}

export async function fetchOnlySnapsPlan(
  creatorWallet: string,
  signal?: AbortSignal,
): Promise<OnlySnapsPlanResponse> {
  const res = await fetch(
    `${getSnapzoApiBaseUrl()}/api/onlysnaps/plan/${creatorWallet}`,
    { signal },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `fetchOnlySnapsPlan failed (${res.status}): ${text || res.statusText}`
    );
  }
  return (await res.json()) as OnlySnapsPlanResponse;
}

export async function fetchOnlySnapsStatus(
  creatorWallet: string,
  viewerWallet: string,
  signal?: AbortSignal,
): Promise<OnlySnapsStatusResponse> {
  const url = new URL(`${getSnapzoApiBaseUrl()}/api/onlysnaps/status`);
  url.searchParams.set("creatorWallet", creatorWallet);
  url.searchParams.set("viewerWallet", viewerWallet);
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `fetchOnlySnapsStatus failed (${res.status}): ${text || res.statusText}`
    );
  }
  return (await res.json()) as OnlySnapsStatusResponse;
}

export async function fetchOnlySnapsFeed(
  params: { viewerWallet: string; limit?: number; cursor?: string },
  signal?: AbortSignal
): Promise<FeedResponse> {
  const url = new URL(`${getSnapzoApiBaseUrl()}/api/onlysnaps/feed`);
  url.searchParams.set("viewerWallet", params.viewerWallet);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.cursor) url.searchParams.set("cursor", params.cursor);
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `fetchOnlySnapsFeed failed (${res.status}): ${text || res.statusText}`
    );
  }
  return (await res.json()) as FeedResponse;
}

export async function fetchStoriesFeed(
  params?: { viewerWallet?: string },
  signal?: AbortSignal
): Promise<StoriesFeedResponse> {
  const url = new URL(`${getSnapzoApiBaseUrl()}/api/stories/feed`);
  if (params?.viewerWallet) url.searchParams.set("viewerWallet", params.viewerWallet);
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchStoriesFeed failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as StoriesFeedResponse;
}

export async function createStory(input: {
  creatorWallet: string;
  mediaBase64: string;
  mediaName?: string;
  mediaMimeType?: string;
  onProgress?: (percent: number) => void;
}): Promise<void> {
  const { onProgress, ...payload } = input;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${getSnapzoApiBaseUrl()}/api/stories`, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      onProgress(percent);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(
        new Error(
          `createStory failed (${xhr.status}): ${xhr.responseText || xhr.statusText}`
        )
      );
    };
    xhr.onerror = () => reject(new Error("createStory failed: network error"));
    xhr.send(JSON.stringify(payload));
  });
}

export async function markStorySeen(input: {
  viewerWallet: string;
  storyId: string;
}): Promise<void> {
  const res = await fetch(`${getSnapzoApiBaseUrl()}/api/stories/seen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`markStorySeen failed (${res.status}): ${text || res.statusText}`);
  }
}

export async function upsertOnlySnapsPlan(input: {
  creatorWallet: string;
  monthlyPriceWei: string;
  txHash?: string;
}): Promise<OnlySnapsPlanResponse> {
  const res = await fetch(`${getSnapzoApiBaseUrl()}/api/onlysnaps/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `upsertOnlySnapsPlan failed (${res.status}): ${text || res.statusText}`
    );
  }
  return (await res.json()) as OnlySnapsPlanResponse;
}

export async function recordOnlySnapsSubscription(input: {
  creatorWallet: string;
  subscriberWallet: string;
  txHash: string;
  expectedAmountWei?: string;
}): Promise<{
  creatorWallet: string;
  subscriberWallet: string;
  amountWei: string;
  periodStart: number;
  periodEnd: number;
  expiresAt: string;
  renewalsCount: number;
  txHash: string;
}> {
  const res = await fetch(`${getSnapzoApiBaseUrl()}/api/onlysnaps/subscription/record`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `recordOnlySnapsSubscription failed (${res.status}): ${text || res.statusText}`
    );
  }
  return (await res.json()) as {
    creatorWallet: string;
    subscriberWallet: string;
    amountWei: string;
    periodStart: number;
    periodEnd: number;
    expiresAt: string;
    renewalsCount: number;
    txHash: string;
  };
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

export async function fetchPostByPostId(
  postId: string,
  params?: { viewer?: string },
  signal?: AbortSignal,
): Promise<PostDetailResponse> {
  const url = new URL(`${getSnapzoApiBaseUrl()}/api/posts/${postId}`);
  if (params?.viewer) url.searchParams.set("viewer", params.viewer);
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchPostByPostId failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as PostDetailResponse;
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

export async function deleteAdminPost(postObjectId: string): Promise<{
  ok: boolean;
  removed: Record<string, number>;
}> {
  const res = await fetch(`${getSnapzoApiBaseUrl()}/api/admin/posts/${postObjectId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`deleteAdminPost failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as { ok: boolean; removed: Record<string, number> };
}
