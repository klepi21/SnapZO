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
  const isLocked = body.isLocked ?? true;

  if (typeof content !== 'string') {
    throw badRequest('content must be a string');
  }
  if (typeof isLocked !== 'boolean') {
    throw badRequest('isLocked must be a boolean');
  }

  const price = Number(body.unlockPrice ?? 0);
  if (!Number.isFinite(price) || price < 0) {
    throw badRequest('unlockPrice must be a non-negative number');
  }
  if (isLocked && price <= 0) {
    throw badRequest('locked posts require unlockPrice > 0');
  }

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
    isLocked,
    unlockPrice: price,
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

  let unlockedSet = new Set<string>();
  if (viewer) {
    const [unlocks, socialUnlocks] = await Promise.all([
      Unlock.find({ post: { $in: postIds }, userWallet: viewer }).select('post').lean(),
      SocialUnlock.find({ post: { $in: postIds }, userWallet: viewer }).select('post').lean(),
    ]);
    unlockedSet = new Set([
      ...unlocks.map((u) => String(u.post)),
      ...socialUnlocks.map((u) => String(u.post)),
    ]);
  }

  const [tipCounts, replyCounts, socialReplyCounts] = await Promise.all([
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
  ]);
  const creators = await User.find({ walletAddress: { $in: creatorWallets } })
    .select('walletAddress displayName username profileImage')
    .lean();

  const tipMap = new Map(tipCounts.map((t) => [String(t._id), t.count]));
  const replyMap = new Map(replyCounts.map((r) => [String(r._id), r.count]));
  const socialReplyMap = new Map(socialReplyCounts.map((r) => [String(r._id), r.count]));
  const creatorMap = new Map(creators.map((u) => [u.walletAddress.toLowerCase(), u]));

  const items = posts.map((p) => {
    const idStr = String(p._id);
    const unlockedByMe = !p.isLocked || unlockedSet.has(idStr);
    const creator = creatorMap.get(p.creatorWallet.toLowerCase());
    return {
      id: idStr,
      postId: p.postId,
      creatorWallet: p.creatorWallet,
      creatorDisplayName: creator?.displayName ?? null,
      creatorUsername: creator?.username ?? null,
      creatorProfileImage: creator?.profileImage ?? null,
      content: p.content,
      ipfsHash: unlockedByMe ? p.ipfsHash : undefined,
      isLocked: p.isLocked,
      unlockPrice: p.unlockPrice,
      blurImage: p.blurImage,
      totalTips: p.totalTips,
      createdAt: p.createdAt,
      unlockedByMe,
      tipCount: tipMap.get(idStr) ?? 0,
      replyCount: (replyMap.get(idStr) ?? 0) + (socialReplyMap.get(idStr) ?? 0),
      commentCount: (replyMap.get(idStr) ?? 0) + (socialReplyMap.get(idStr) ?? 0),
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
    ipfsHash: unlockedByMe ? post.ipfsHash : undefined,
    isLocked: post.isLocked,
    unlockPrice: post.unlockPrice,
    blurImage: post.blurImage,
    totalTips: post.totalTips,
    createdAt: post.createdAt,
    unlockedByMe,
  });
}
