import type { Request, Response } from 'express';
import Post from '../models/Post';
import Reply from '../models/Reply';
import SocialReply from '../models/SocialReply';
import SocialUnlock from '../models/SocialUnlock';
import Tip from '../models/Tip';
import Unlock from '../models/Unlock';
import User from '../models/User';
import CreatorSubscriptionPlan from '../models/CreatorSubscriptionPlan';
import SubscriptionAccess from '../models/SubscriptionAccess';
import { badRequest } from '../utils/errors';

type AdminTableKey =
  | 'likes'
  | 'replies'
  | 'unlocks'
  | 'users'
  | 'activity'
  | 'posts'
  | 'subscriptions';

interface PaginationResult<T> {
  items: T[];
  total: number;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function shortWallet(wallet: string): string {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

async function getLikesPage(skip: number, pageSize: number): Promise<PaginationResult<Record<string, unknown>>> {
  const [tips, total] = await Promise.all([
    Tip.find().sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    Tip.countDocuments(),
  ]);
  const postIds = [...new Set(tips.map((t) => String(t.post)))];
  const wallets = [...new Set(tips.map((t) => t.fromWallet.toLowerCase()))];
  const [posts, users] = await Promise.all([
    Post.find({ _id: { $in: postIds } }).select('postId creatorWallet').lean(),
    User.find({ walletAddress: { $in: wallets } })
      .select('walletAddress displayName username profileImage')
      .lean(),
  ]);
  const postMap = new Map(posts.map((p) => [String(p._id), p]));
  const userMap = new Map(users.map((u) => [u.walletAddress.toLowerCase(), u]));
  return {
    total,
    items: tips.map((tip) => {
      const post = postMap.get(String(tip.post));
      const liker = userMap.get(tip.fromWallet.toLowerCase());
      return {
        id: String(tip._id),
        createdAt: tip.createdAt,
        txHash: tip.txHash,
        amount: tip.amount,
        postObjectId: String(tip.post),
        postId: post?.postId ?? null,
        postCreatorWallet: post?.creatorWallet ?? null,
        wallet: tip.fromWallet,
        displayName: liker?.displayName ?? null,
        username: liker?.username ?? null,
        profileImage: liker?.profileImage ?? null,
        label: liker?.displayName || liker?.username || shortWallet(tip.fromWallet),
      };
    }),
  };
}

async function getRepliesPage(skip: number, pageSize: number): Promise<PaginationResult<Record<string, unknown>>> {
  const [replies, total] = await Promise.all([
    SocialReply.find().sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    SocialReply.countDocuments(),
  ]);
  const postIds = [...new Set(replies.map((r) => String(r.post)))];
  const wallets = [...new Set(replies.flatMap((r) => [r.requesterWallet, r.creatorWallet]))];
  const [posts, users] = await Promise.all([
    Post.find({ _id: { $in: postIds } }).select('postId creatorWallet').lean(),
    User.find({ walletAddress: { $in: wallets.map((w) => w.toLowerCase()) } })
      .select('walletAddress displayName username profileImage')
      .lean(),
  ]);
  const postMap = new Map(posts.map((p) => [String(p._id), p]));
  const userMap = new Map(users.map((u) => [u.walletAddress.toLowerCase(), u]));
  return {
    total,
    items: replies.map((reply) => {
      const post = postMap.get(String(reply.post));
      const requester = userMap.get(reply.requesterWallet.toLowerCase());
      const creator = userMap.get(reply.creatorWallet.toLowerCase());
      return {
        id: String(reply._id),
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        status: reply.status,
        requestId: reply.requestId,
        requestTxHash: reply.requestTxHash,
        fulfillTxHash: reply.fulfillTxHash ?? null,
        requesterComment: reply.requesterComment,
        creatorReply: reply.creatorReply ?? null,
        postObjectId: String(reply.post),
        postId: post?.postId ?? null,
        requesterWallet: reply.requesterWallet,
        requesterLabel:
          requester?.displayName || requester?.username || shortWallet(reply.requesterWallet),
        creatorWallet: reply.creatorWallet,
        creatorLabel: creator?.displayName || creator?.username || shortWallet(reply.creatorWallet),
      };
    }),
  };
}

async function getUnlocksPage(page: number, pageSize: number): Promise<PaginationResult<Record<string, unknown>>> {
  const start = (page - 1) * pageSize;
  const windowLimit = page * pageSize;
  const [[socialRows, legacyRows], [socialTotal, legacyTotal]] = await Promise.all([
    Promise.all([
      SocialUnlock.find().sort({ createdAt: -1 }).limit(windowLimit).lean(),
      Unlock.find().sort({ unlockedAt: -1 }).limit(windowLimit).lean(),
    ]),
    Promise.all([SocialUnlock.countDocuments(), Unlock.countDocuments()]),
  ]);
  const merged = [
    ...socialRows.map((row) => ({
      id: `social:${String(row._id)}`,
      source: 'social',
      createdAt: row.createdAt ?? null,
      txHash: row.txHash,
      wallet: row.userWallet,
      postObjectId: String(row.post),
      amount: row.amountWei,
    })),
    ...legacyRows.map((row) => ({
      id: `legacy:${String(row._id)}`,
      source: 'legacy',
      createdAt: row.unlockedAt ?? null,
      txHash: row.txHash,
      wallet: row.userWallet,
      postObjectId: String(row.post),
      amount: row.amount,
    })),
  ].sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });
  const pageRows = merged.slice(start, start + pageSize);
  const postIds = [...new Set(pageRows.map((r) => r.postObjectId))];
  const wallets = [...new Set(pageRows.map((r) => r.wallet.toLowerCase()))];
  const [posts, users] = await Promise.all([
    Post.find({ _id: { $in: postIds } }).select('postId').lean(),
    User.find({ walletAddress: { $in: wallets } })
      .select('walletAddress displayName username')
      .lean(),
  ]);
  const postMap = new Map(posts.map((p) => [String(p._id), p]));
  const userMap = new Map(users.map((u) => [u.walletAddress.toLowerCase(), u]));
  return {
    total: socialTotal + legacyTotal,
    items: pageRows.map((row) => {
      const user = userMap.get(row.wallet.toLowerCase());
      return {
        ...row,
        postId: postMap.get(row.postObjectId)?.postId ?? null,
        label: user?.displayName || user?.username || shortWallet(row.wallet),
      };
    }),
  };
}

async function getUsersPage(skip: number, pageSize: number): Promise<PaginationResult<Record<string, unknown>>> {
  const [users, total] = await Promise.all([
    User.find().sort({ updatedAt: -1, createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    User.countDocuments(),
  ]);
  const wallets = users.map((u) => u.walletAddress.toLowerCase());
  const [postCounts, tipCounts, replyCounts, socialUnlockCounts, unlockCounts] = await Promise.all([
    Post.aggregate<{ _id: string; count: number }>([
      { $match: { creatorWallet: { $in: wallets } } },
      { $group: { _id: '$creatorWallet', count: { $sum: 1 } } },
    ]),
    Tip.aggregate<{ _id: string; count: number }>([
      { $match: { fromWallet: { $in: wallets } } },
      { $group: { _id: '$fromWallet', count: { $sum: 1 } } },
    ]),
    SocialReply.aggregate<{ _id: string; count: number }>([
      { $match: { requesterWallet: { $in: wallets } } },
      { $group: { _id: '$requesterWallet', count: { $sum: 1 } } },
    ]),
    SocialUnlock.aggregate<{ _id: string; count: number }>([
      { $match: { userWallet: { $in: wallets } } },
      { $group: { _id: '$userWallet', count: { $sum: 1 } } },
    ]),
    Unlock.aggregate<{ _id: string; count: number }>([
      { $match: { userWallet: { $in: wallets } } },
      { $group: { _id: '$userWallet', count: { $sum: 1 } } },
    ]),
  ]);
  const postsMap = new Map(postCounts.map((r) => [r._id.toLowerCase(), r.count]));
  const tipsMap = new Map(tipCounts.map((r) => [r._id.toLowerCase(), r.count]));
  const repliesMap = new Map(replyCounts.map((r) => [r._id.toLowerCase(), r.count]));
  const socialUnlocksMap = new Map(socialUnlockCounts.map((r) => [r._id.toLowerCase(), r.count]));
  const unlocksMap = new Map(unlockCounts.map((r) => [r._id.toLowerCase(), r.count]));
  return {
    total,
    items: users.map((user) => {
      const w = user.walletAddress.toLowerCase();
      return {
        id: String(user._id),
        wallet: user.walletAddress,
        displayName: user.displayName ?? null,
        username: user.username ?? null,
        profileImage: user.profileImage ?? null,
        bio: user.bio ?? null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt ?? null,
        posts: postsMap.get(w) ?? 0,
        likes: tipsMap.get(w) ?? 0,
        replies: repliesMap.get(w) ?? 0,
        unlocks: (socialUnlocksMap.get(w) ?? 0) + (unlocksMap.get(w) ?? 0),
      };
    }),
  };
}

async function getPostsPage(skip: number, pageSize: number): Promise<PaginationResult<Record<string, unknown>>> {
  const [posts, total] = await Promise.all([
    Post.find().sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    Post.countDocuments(),
  ]);
  const postIds = posts.map((p) => p._id);
  const creatorWallets = [...new Set(posts.map((p) => p.creatorWallet.toLowerCase()))];
  const [users, tipCounts, socialReplyCounts, replyCounts, socialUnlockCounts, unlockCounts] = await Promise.all([
    User.find({ walletAddress: { $in: creatorWallets } })
      .select('walletAddress displayName username')
      .lean(),
    Tip.aggregate<{ _id: string; count: number }>([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
    ]),
    SocialReply.aggregate<{ _id: string; count: number }>([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
    ]),
    Reply.aggregate<{ _id: string; count: number }>([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
    ]),
    SocialUnlock.aggregate<{ _id: string; count: number }>([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
    ]),
    Unlock.aggregate<{ _id: string; count: number }>([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
    ]),
  ]);
  const userMap = new Map(users.map((u) => [u.walletAddress.toLowerCase(), u]));
  const tipMap = new Map(tipCounts.map((r) => [String(r._id), r.count]));
  const socialReplyMap = new Map(socialReplyCounts.map((r) => [String(r._id), r.count]));
  const replyMap = new Map(replyCounts.map((r) => [String(r._id), r.count]));
  const socialUnlockMap = new Map(socialUnlockCounts.map((r) => [String(r._id), r.count]));
  const unlockMap = new Map(unlockCounts.map((r) => [String(r._id), r.count]));
  return {
    total,
    items: posts.map((post) => {
      const creator = userMap.get(post.creatorWallet.toLowerCase());
      const id = String(post._id);
      return {
        id,
        postId: post.postId,
        createdAt: post.createdAt,
        visibility: post.visibility,
        isLocked: post.isLocked,
        unlockPrice: post.unlockPrice,
        totalTipsAmount: post.totalTips,
        creatorWallet: post.creatorWallet,
        creatorLabel: creator?.displayName || creator?.username || shortWallet(post.creatorWallet),
        likes: tipMap.get(id) ?? 0,
        replies: (socialReplyMap.get(id) ?? 0) + (replyMap.get(id) ?? 0),
        unlocks: (socialUnlockMap.get(id) ?? 0) + (unlockMap.get(id) ?? 0),
        contentPreview: (post.content ?? '').slice(0, 120),
      };
    }),
  };
}

async function getActivityPage(page: number, pageSize: number): Promise<PaginationResult<Record<string, unknown>>> {
  const start = (page - 1) * pageSize;
  const windowLimit = page * pageSize;
  const [tips, replies, socialUnlocks, posts, counts] = await Promise.all([
    Tip.find().sort({ createdAt: -1 }).limit(windowLimit).lean(),
    SocialReply.find().sort({ createdAt: -1 }).limit(windowLimit).lean(),
    SocialUnlock.find().sort({ createdAt: -1 }).limit(windowLimit).lean(),
    Post.find().sort({ createdAt: -1 }).limit(windowLimit).lean(),
    Promise.all([
      Tip.countDocuments(),
      SocialReply.countDocuments(),
      SocialUnlock.countDocuments(),
      Post.countDocuments(),
    ]),
  ]);
  const activity = [
    ...tips.map((tip) => ({
      id: `tip:${String(tip._id)}`,
      type: 'like',
      createdAt: tip.createdAt,
      wallet: tip.fromWallet,
      postObjectId: String(tip.post),
      txHash: tip.txHash,
      summary: `Like tip ${tip.amount}`,
    })),
    ...replies.map((reply) => ({
      id: `reply:${String(reply._id)}`,
      type: reply.status === 'responded' ? 'reply-fulfilled' : 'reply-request',
      createdAt: reply.createdAt,
      wallet: reply.requesterWallet,
      postObjectId: String(reply.post),
      txHash: reply.fulfillTxHash ?? reply.requestTxHash,
      summary: reply.status === 'responded' ? 'Paid reply fulfilled' : 'Paid reply requested',
    })),
    ...socialUnlocks.map((unlock) => ({
      id: `unlock:${String(unlock._id)}`,
      type: 'unlock',
      createdAt: unlock.createdAt,
      wallet: unlock.userWallet,
      postObjectId: String(unlock.post),
      txHash: unlock.txHash,
      summary: 'Unlocked post',
    })),
    ...posts.map((post) => ({
      id: `post:${String(post._id)}`,
      type: 'post-created',
      createdAt: post.createdAt,
      wallet: post.creatorWallet,
      postObjectId: String(post._id),
      txHash: null,
      summary: post.isLocked ? 'Created locked post' : 'Created post',
      visibility: post.visibility,
    })),
  ].sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });
  const pageRows = activity.slice(start, start + pageSize);
  const postIds = [...new Set(pageRows.map((r) => r.postObjectId))];
  const wallets = [...new Set(pageRows.map((r) => r.wallet.toLowerCase()))];
  const [postRows, users] = await Promise.all([
    Post.find({ _id: { $in: postIds } }).select('postId').lean(),
    User.find({ walletAddress: { $in: wallets } }).select('walletAddress displayName username').lean(),
  ]);
  const postMap = new Map(postRows.map((p) => [String(p._id), p.postId]));
  const userMap = new Map(users.map((u) => [u.walletAddress.toLowerCase(), u]));
  return {
    total: counts[0] + counts[1] + counts[2] + counts[3],
    items: pageRows.map((row) => {
      const user = userMap.get(row.wallet.toLowerCase());
      return {
        ...row,
        postId: postMap.get(row.postObjectId) ?? null,
        label: user?.displayName || user?.username || shortWallet(row.wallet),
      };
    }),
  };
}

async function getSubscriptionsPage(
  skip: number,
  pageSize: number
): Promise<PaginationResult<Record<string, unknown>>> {
  const now = new Date();
  const [rows, total, plans] = await Promise.all([
    SubscriptionAccess.find().sort({ updatedAt: -1, createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    SubscriptionAccess.countDocuments(),
    CreatorSubscriptionPlan.find().select('creatorWallet monthlyPriceWei').lean(),
  ]);
  const wallets = [
    ...new Set(rows.flatMap((r) => [r.creatorWallet.toLowerCase(), r.subscriberWallet.toLowerCase()])),
  ];
  const users = await User.find({ walletAddress: { $in: wallets } })
    .select('walletAddress displayName username')
    .lean();
  const userMap = new Map(users.map((u) => [u.walletAddress.toLowerCase(), u]));
  const planMap = new Map(plans.map((p) => [p.creatorWallet.toLowerCase(), p.monthlyPriceWei]));
  return {
    total,
    items: rows.map((row) => {
      const creator = userMap.get(row.creatorWallet.toLowerCase());
      const subscriber = userMap.get(row.subscriberWallet.toLowerCase());
      return {
        id: String(row._id),
        creatorWallet: row.creatorWallet,
        creatorLabel: creator?.displayName || creator?.username || shortWallet(row.creatorWallet),
        subscriberWallet: row.subscriberWallet,
        subscriberLabel:
          subscriber?.displayName || subscriber?.username || shortWallet(row.subscriberWallet),
        expiresAt: row.expiresAt,
        isActive: row.expiresAt > now,
        renewalsCount: row.renewalsCount ?? 0,
        currentPeriodStart: row.currentPeriodStart ?? null,
        currentPeriodEnd: row.currentPeriodEnd ?? null,
        latestAmountWei: row.latestAmountWei ?? null,
        monthlyPriceWei: planMap.get(row.creatorWallet.toLowerCase()) ?? null,
        latestTxHash: row.latestTxHash ?? null,
        updatedAt: row.updatedAt ?? null,
      };
    }),
  };
}

export async function getAdminActivityTable(req: Request, res: Response): Promise<void> {
  const table = String(req.query.table ?? 'activity') as AdminTableKey;
  const allowed: AdminTableKey[] = [
    'likes',
    'replies',
    'unlocks',
    'users',
    'activity',
    'posts',
    'subscriptions',
  ];
  if (!allowed.includes(table)) {
    throw badRequest(`table must be one of: ${allowed.join(', ')}`);
  }
  const page = parsePositiveInt(req.query.page, 1);
  const pageSize = Math.min(parsePositiveInt(req.query.pageSize, 20), 100);
  const skip = (page - 1) * pageSize;

  let result: PaginationResult<Record<string, unknown>>;
  if (table === 'likes') {
    result = await getLikesPage(skip, pageSize);
  } else if (table === 'replies') {
    result = await getRepliesPage(skip, pageSize);
  } else if (table === 'unlocks') {
    result = await getUnlocksPage(page, pageSize);
  } else if (table === 'users') {
    result = await getUsersPage(skip, pageSize);
  } else if (table === 'posts') {
    result = await getPostsPage(skip, pageSize);
  } else if (table === 'subscriptions') {
    result = await getSubscriptionsPage(skip, pageSize);
  } else {
    result = await getActivityPage(page, pageSize);
  }

  const [
    tipsCount,
    repliesCount,
    unlocksCount,
    usersCount,
    postsCount,
    onlySnapsPlansCount,
    onlySnapsActiveCount,
    onlySnapsRecordsCount,
  ] = await Promise.all([
    Tip.countDocuments(),
    SocialReply.countDocuments(),
    SocialUnlock.countDocuments(),
    User.countDocuments(),
    Post.countDocuments(),
    CreatorSubscriptionPlan.countDocuments(),
    SubscriptionAccess.countDocuments({ expiresAt: { $gt: new Date() } }),
    SubscriptionAccess.countDocuments(),
  ]);

  res.json({
    table,
    page,
    pageSize,
    total: result.total,
    totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
    summary: {
      likes: tipsCount,
      replies: repliesCount,
      unlocks: unlocksCount,
      users: usersCount,
      posts: postsCount,
      onlySnapsPlans: onlySnapsPlansCount,
      onlySnapsActive: onlySnapsActiveCount,
      onlySnapsRecords: onlySnapsRecordsCount,
    },
    items: result.items,
  });
}

export async function deleteAdminPost(req: Request, res: Response): Promise<void> {
  const postObjectId = String(req.params.postObjectId ?? '').trim();
  if (!/^[0-9a-fA-F]{24}$/.test(postObjectId)) {
    throw badRequest('postObjectId must be a valid post object id');
  }
  const post = await Post.findById(postObjectId).lean();
  if (!post) {
    throw badRequest('Post not found');
  }
  const [tips, socialReplies, replies, socialUnlocks, unlocks] = await Promise.all([
    Tip.deleteMany({ post: post._id }),
    SocialReply.deleteMany({ post: post._id }),
    Reply.deleteMany({ post: post._id }),
    SocialUnlock.deleteMany({ post: post._id }),
    Unlock.deleteMany({ post: post._id }),
  ]);
  await Post.deleteOne({ _id: post._id });
  res.json({
    ok: true,
    removed: {
      post: 1,
      tips: tips.deletedCount ?? 0,
      socialReplies: socialReplies.deletedCount ?? 0,
      replies: replies.deletedCount ?? 0,
      socialUnlocks: socialUnlocks.deletedCount ?? 0,
      unlocks: unlocks.deletedCount ?? 0,
    },
  });
}
