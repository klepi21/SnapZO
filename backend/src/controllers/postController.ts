import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';
import Post from '../models/Post';
import User from '../models/User';
import Unlock from '../models/Unlock';
import SocialUnlock from '../models/SocialUnlock';
import Tip from '../models/Tip';
import Reply from '../models/Reply';
import SocialReply from '../models/SocialReply';
import SubscriptionAccess from '../models/SubscriptionAccess';
import * as ipfsService from '../services/ipfsService';
import { badRequest, notFound } from '../utils/errors';
import { requireAddress } from '../utils/validation';

interface CreatePostBody {
  creatorWallet?: string;
  content?: string;
  mediaBase64?: string;
  mediaName?: string;
  mediaMimeType?: string;
  blurImageBase64?: string;
  blurMediaName?: string;
  blurMediaMimeType?: string;
  isLocked?: boolean;
  visibility?: 'public' | 'unlock' | 'subscriber_only';
  unlockPrice?: number | string;
  postId?: string;
}

/**
 * POST /api/posts — create a post.
 * Optional `mediaBase64` is uploaded to IPFS as the unlocked media.
 * Optional `blurImageBase64` is uploaded as the blurred preview.
 */
export async function createPost(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as CreatePostBody;

  const wallet = requireAddress(body.creatorWallet, 'creatorWallet').toLowerCase();
  const content = body.content ?? '';
  const requestedVisibility = body.visibility;
  const requestedIsLocked = body.isLocked;

  if (typeof content !== 'string') {
    throw badRequest('content must be a string');
  }
  if (requestedIsLocked !== undefined && typeof requestedIsLocked !== 'boolean') {
    throw badRequest('isLocked must be a boolean');
  }
  if (
    requestedVisibility !== undefined &&
    requestedVisibility !== 'public' &&
    requestedVisibility !== 'unlock' &&
    requestedVisibility !== 'subscriber_only'
  ) {
    throw badRequest('visibility must be one of: public, unlock, subscriber_only');
  }

  const visibility =
    requestedVisibility ?? (requestedIsLocked === true ? 'unlock' : 'public');
  const isLocked = visibility === 'unlock';

  const price = Number(body.unlockPrice ?? 0);
  if (!Number.isFinite(price) || price < 0) {
    throw badRequest('unlockPrice must be a non-negative number');
  }
  if (visibility === 'unlock' && price <= 0) {
    throw badRequest('locked posts require unlockPrice > 0');
  }
  if (visibility === 'subscriber_only' && price > 0) {
    throw badRequest('subscriber_only posts cannot have unlockPrice');
  }
  if (visibility === 'public' && price > 0) {
    throw badRequest('public posts cannot have unlockPrice');
  }

  const normalizedPrice = visibility === 'unlock' ? price : 0;

  let ipfsHash: string | undefined;
  if (body.mediaBase64) {
    ipfsHash = await ipfsService.uploadFile({
      data: body.mediaBase64,
      name: body.mediaName ?? 'media.bin',
      mimeType: body.mediaMimeType ?? 'application/octet-stream',
    });
  }

  let blurHash: string | undefined;
  if (body.blurImageBase64) {
    blurHash = await ipfsService.uploadFile({
      data: body.blurImageBase64,
      name: body.blurMediaName ?? 'blur.bin',
      mimeType: body.blurMediaMimeType ?? 'application/octet-stream',
    });
  }

  // Lazy-create the user row.
  await User.updateOne(
    { walletAddress: wallet },
    { $setOnInsert: { walletAddress: wallet, createdAt: new Date() } },
    { upsert: true }
  );

  const post = await Post.create({
    postId: body.postId ?? uuidv4(),
    creatorWallet: wallet,
    content,
    ipfsHash,
    blurImage: blurHash,
    visibility,
    isLocked,
    unlockPrice: normalizedPrice,
  });

  res.status(201).json(post.toJSON());
}

/**
 * GET /api/feed — public feed.
 * Locked posts hide `ipfsHash` unless `?viewer=` has unlocked them.
 */
export async function getFeed(req: Request, res: Response): Promise<void> {
  const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 100);
  const cursorStr = req.query.cursor as string | undefined;
  const cursor = cursorStr ? new Date(cursorStr) : null;
  const viewer = req.query.viewer
    ? requireAddress(req.query.viewer, 'viewer').toLowerCase()
    : null;

  const filter: Record<string, unknown> = {};
  if (cursor && !Number.isNaN(cursor.getTime())) {
    filter.createdAt = { $lt: cursor };
  }

  const posts = await Post.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  if (posts.length === 0) {
    res.json({ items: [], nextCursor: null });
    return;
  }

  const postIds = posts.map((p) => p._id);
  const creatorWallets = [...new Set(posts.map((p) => p.creatorWallet.toLowerCase()))];
  const subscriberOnlyCreators = [
    ...new Set(
      posts
        .filter((p) => p.visibility === 'subscriber_only')
        .map((p) => p.creatorWallet.toLowerCase())
    ),
  ];

  let unlockedSet = new Set<string>();
  let activeOnlySnapsCreators = new Set<string>();
  if (viewer) {
    const [unlocks, socialUnlocks, activeSubscriptions] = await Promise.all([
      Unlock.find({ post: { $in: postIds }, userWallet: viewer }).select('post').lean(),
      SocialUnlock.find({ post: { $in: postIds }, userWallet: viewer }).select('post').lean(),
      subscriberOnlyCreators.length > 0
        ? SubscriptionAccess.find({
            subscriberWallet: viewer,
            creatorWallet: { $in: subscriberOnlyCreators },
            expiresAt: { $gt: new Date() },
          })
            .select('creatorWallet')
            .lean()
        : Promise.resolve([]),
    ]);
    unlockedSet = new Set([
      ...unlocks.map((u) => String(u.post)),
      ...socialUnlocks.map((u) => String(u.post)),
    ]);
    activeOnlySnapsCreators = new Set(activeSubscriptions.map((s) => s.creatorWallet.toLowerCase()));
  }

  const [tipCounts, replyCounts, socialReplyCounts, unlockCounts, socialUnlockCounts] =
    await Promise.all([
    Tip.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
    ]),
    Reply.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
    ]),
    SocialReply.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
    ]),
    Unlock.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
    ]),
    SocialUnlock.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
    ]),
  ]);
  const creators = await User.find({ walletAddress: { $in: creatorWallets } })
    .select('walletAddress displayName username profileImage')
    .lean();

  const tipMap = new Map(tipCounts.map((t) => [String(t._id), t.count]));
  const replyMap = new Map(replyCounts.map((r) => [String(r._id), r.count]));
  const socialReplyMap = new Map(socialReplyCounts.map((r) => [String(r._id), r.count]));
  const unlockMap = new Map(unlockCounts.map((u) => [String(u._id), u.count]));
  const socialUnlockMap = new Map(socialUnlockCounts.map((u) => [String(u._id), u.count]));
  const creatorMap = new Map(creators.map((u) => [u.walletAddress.toLowerCase(), u]));

  const items = posts.map((p) => {
    const idStr = String(p._id);
    const isCreatorViewer = Boolean(
      viewer && p.creatorWallet.toLowerCase() === viewer.toLowerCase()
    );
    const hasOnlySnapsAccess =
      p.visibility !== 'subscriber_only' ||
      isCreatorViewer ||
      Boolean(viewer && activeOnlySnapsCreators.has(p.creatorWallet.toLowerCase()));
    const unlockedByMe =
      (p.visibility !== 'unlock' || !p.isLocked || isCreatorViewer || unlockedSet.has(idStr)) &&
      hasOnlySnapsAccess;
    const creator = creatorMap.get(p.creatorWallet.toLowerCase());
    return {
      id: idStr,
      postId: p.postId,
      creatorWallet: p.creatorWallet,
      creatorDisplayName: creator?.displayName ?? null,
      creatorUsername: creator?.username ?? null,
      creatorProfileImage: creator?.profileImage ?? null,
      content: p.content,
      visibility: p.visibility,
      ipfsHash: unlockedByMe ? p.ipfsHash : undefined,
      isLocked: p.isLocked,
      unlockPrice: p.unlockPrice,
      blurImage: p.blurImage,
      totalTips: p.totalTips,
      createdAt: p.createdAt,
      unlockedByMe,
      subscriberOnlyLocked: p.visibility === 'subscriber_only' && !hasOnlySnapsAccess,
      tipCount: tipMap.get(idStr) ?? 0,
      replyCount: (replyMap.get(idStr) ?? 0) + (socialReplyMap.get(idStr) ?? 0),
      commentCount: (replyMap.get(idStr) ?? 0) + (socialReplyMap.get(idStr) ?? 0),
      unlockCount: (unlockMap.get(idStr) ?? 0) + (socialUnlockMap.get(idStr) ?? 0),
    };
  });

  const nextCursor = posts.length === limit ? posts[posts.length - 1].createdAt : null;
  res.json({ items, nextCursor });
}

/** GET /api/posts/:postId — single post. */
export async function getPost(req: Request, res: Response): Promise<void> {
  const { postId } = req.params;
  const post = await Post.findOne({ postId }).lean();
  if (!post) throw notFound('Post not found');

  const viewer = req.query.viewer
    ? requireAddress(req.query.viewer, 'viewer').toLowerCase()
    : null;

  let unlockedByMe = !post.isLocked;
  let hasOnlySnapsAccess = post.visibility !== 'subscriber_only';
  const isCreatorViewer = Boolean(
    viewer && post.creatorWallet.toLowerCase() === viewer.toLowerCase()
  );
  if (post.visibility === 'subscriber_only') {
    if (isCreatorViewer) {
      hasOnlySnapsAccess = true;
    } else if (viewer) {
      const activeSub = await SubscriptionAccess.exists({
        creatorWallet: post.creatorWallet.toLowerCase(),
        subscriberWallet: viewer,
        expiresAt: { $gt: new Date() },
      });
      hasOnlySnapsAccess = Boolean(activeSub);
    } else {
      hasOnlySnapsAccess = false;
    }
  }
  if (post.visibility !== 'unlock') {
    unlockedByMe = hasOnlySnapsAccess;
  }
  if (viewer && post.isLocked) {
    const [u, su] = await Promise.all([
      Unlock.exists({ post: post._id, userWallet: viewer }),
      SocialUnlock.exists({ post: post._id, userWallet: viewer }),
    ]);
    unlockedByMe = Boolean(u || su);
  }
  const creator = await User.findOne({ walletAddress: post.creatorWallet.toLowerCase() })
    .select('displayName username profileImage')
    .lean();

  res.json({
    id: String(post._id),
    postId: post.postId,
    creatorWallet: post.creatorWallet,
    creatorDisplayName: creator?.displayName ?? null,
    creatorUsername: creator?.username ?? null,
    creatorProfileImage: creator?.profileImage ?? null,
    content: post.content,
    visibility: post.visibility,
    ipfsHash: unlockedByMe ? post.ipfsHash : undefined,
    isLocked: post.isLocked,
    unlockPrice: post.unlockPrice,
    blurImage: post.blurImage,
    totalTips: post.totalTips,
    createdAt: post.createdAt,
    unlockedByMe,
    subscriberOnlyLocked: post.visibility === 'subscriber_only' && !hasOnlySnapsAccess,
  });
}
