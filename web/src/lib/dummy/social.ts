import { getAddress, keccak256, stringToBytes, type Address } from "viem";

/** Demo-only “creator” address derived from post id (tips route on-chain here). */
export function dummyTipRecipient(postId: string): Address {
  const digest = keccak256(stringToBytes(`snapzo:creator:${postId}`));
  return getAddress(`0x${digest.slice(-40)}`);
}

export interface FeedPost {
  id: string;
  creatorWallet?: string;
  postObjectId?: string;
  socialPostId?: number;
  userName: string;
  userHandle: string;
  avatarUrl?: string;
  avatarSeed: number;
  timeAgo: string;
  imageUrl?: string;
  imageId: number;
  imageWidth: number;
  imageHeight: number;
  likes: number;
  comments: number;
  unlockCount?: number;
  likedBySeeds: number[];
  caption: string;
  visibility?: "public" | "unlock" | "subscriber_only";
  subscriberOnlyLocked?: boolean;
  /** When true, media stays blurred until user confirms an on-chain unlock tx. */
  contentLocked?: boolean;
  unlockedByMe?: boolean;
  /** Creator-set unlock quote in MUSD (human); on-chain settlement is SNAP at hub NAV. */
  unlockPriceMusd?: number;
  /** SNAP tip / unlock / paid-comment recipient (dummy address per post). */
  tipRecipient: Address;
}

export const DUMMY_POSTS: FeedPost[] = [
  {
    id: "1",
    userName: "Nazmul Rahman",
    userHandle: "nazmul",
    avatarSeed: 64,
    timeAgo: "15 Mins Ago",
    imageId: 1003,
    imageWidth: 800,
    imageHeight: 1000,
    likes: 150,
    comments: 200,
    likedBySeeds: [44, 65, 12],
    caption:
      "Standing above the clouds today — nothing beats this view. Grateful for every moment we get to share.",
    contentLocked: true,
    unlockPriceMusd: 0.1,
    tipRecipient: dummyTipRecipient("1"),
  },
  {
    id: "2",
    userName: "Sara Chen",
    userHandle: "sarac",
    avatarSeed: 26,
    timeAgo: "1 Hr Ago",
    imageId: 1011,
    imageWidth: 800,
    imageHeight: 960,
    likes: 892,
    comments: 41,
    likedBySeeds: [33, 71, 52],
    caption:
      "Golden hour in the city. Who else is out shooting tonight?",
    tipRecipient: dummyTipRecipient("2"),
  },
  {
    id: "3",
    userName: "Marcus Cole",
    userHandle: "marcusc",
    avatarSeed: 91,
    timeAgo: "3 Hrs Ago",
    imageId: 1043,
    imageWidth: 800,
    imageHeight: 1100,
    likes: 2341,
    comments: 156,
    likedBySeeds: [5, 22, 88],
    caption:
      "Trail run complete. Legs are jelly but the mind is clear.",
    tipRecipient: dummyTipRecipient("3"),
  },
];

export const DUMMY_PROFILE = {
  displayName: "Nazmul Rahman",
  handle: "@nazmul009878",
  avatarSeed: 64,
  coverSeed: 1003,
  /** Demo stats shown on profile (not tied to on-chain totals yet). */
  likesLabel: "12.4K",
  repliesLabel: "892",
  earningsLabel: "218",
  gallery: [
    { id: 21, h: 220 },
    { id: 29, h: 280 },
    { id: 40, h: 200 },
    { id: 52, h: 260 },
    { id: 60, h: 240 },
    { id: 76, h: 300 },
    { id: 82, h: 210 },
    { id: 95, h: 250 },
  ],
};

export function picsumAvatar(seed: number, size = 128) {
  return `https://picsum.photos/id/${seed}/${size}/${size}`;
}

export function picsumPost(id: number, w: number, h: number) {
  return `https://picsum.photos/id/${id}/${w}/${h}`;
}
