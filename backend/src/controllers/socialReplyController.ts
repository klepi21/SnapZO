import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import Post from '../models/Post';
import SocialReply from '../models/SocialReply';
import User from '../models/User';
import { badRequest, conflict, notFound } from '../utils/errors';
import { requireAddress, requireString, requireTxHash } from '../utils/validation';

interface SocialReplyRequestBody {
  postObjectId?: string;
  requestId?: string;
  socialPostId?: string;
  requesterWallet?: string;
  creatorWallet?: string;
  stakeAmountWei?: string;
  requestTxHash?: string;
  requesterComment?: string;
}

interface SocialReplyFulfillBody {
  requestId?: string;
  creatorWallet?: string;
  creatorReply?: string;
  commentId?: string;
  fulfillTxHash?: string;
}

function requireHex32(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw badRequest(`${fieldName} must be a 0x-prefixed 32-byte hex`);
  }
  return value.toLowerCase();
}

function requireUintString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw badRequest(`${fieldName} must be a decimal uint string`);
  }
  return value;
}

export async function createSocialReplyRequestRecord(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as SocialReplyRequestBody;
  if (!body.postObjectId || !Types.ObjectId.isValid(body.postObjectId)) {
    throw badRequest('postObjectId must be a valid post id');
  }
  const post = await Post.findById(body.postObjectId).lean();
  if (!post) throw notFound('Post not found');

  const requestId = requireHex32(body.requestId, 'requestId');
  const socialPostId = requireUintString(body.socialPostId, 'socialPostId');
  const requesterWallet = requireAddress(body.requesterWallet, 'requesterWallet').toLowerCase();
  const creatorWallet = requireAddress(body.creatorWallet, 'creatorWallet').toLowerCase();
  const stakeAmountWei = requireUintString(body.stakeAmountWei, 'stakeAmountWei');
  const requestTxHash = requireTxHash(body.requestTxHash, 'requestTxHash');
  const requesterComment = requireString(body.requesterComment, 'requesterComment', { max: 5_000 });

  if (post.creatorWallet !== creatorWallet) {
    throw badRequest('creatorWallet does not match post creator');
  }
  if (requesterWallet === creatorWallet) {
    throw badRequest('requesterWallet cannot equal creatorWallet');
  }

  const exists = await SocialReply.findOne({ requestId }).lean();
  if (exists) throw conflict('requestId already recorded');

  const row = await SocialReply.create({
    post: new Types.ObjectId(body.postObjectId),
    requestId,
    socialPostId,
    requesterWallet,
    creatorWallet,
    stakeAmountWei,
    requestTxHash,
    requesterComment,
    status: 'pending',
  });
  res.status(201).json(row.toJSON());
}

export async function listSocialRepliesForPost(req: Request, res: Response): Promise<void> {
  const postObjectId = req.params.postObjectId;
  if (!postObjectId || !Types.ObjectId.isValid(postObjectId)) {
    throw badRequest('postObjectId must be a valid post id');
  }
  const items = await SocialReply.find({ post: new Types.ObjectId(postObjectId) })
    .sort({ createdAt: 1 })
    .lean();
  const wallets = [...new Set(items.flatMap((i) => [i.requesterWallet, i.creatorWallet]))];
  const users = await User.find({ walletAddress: { $in: wallets } })
    .select('walletAddress displayName username profileImage')
    .lean();
  const userMap = new Map(users.map((u) => [u.walletAddress.toLowerCase(), u]));
  res.json({
    items: items.map((i) => {
      const requester = userMap.get(i.requesterWallet.toLowerCase());
      const creator = userMap.get(i.creatorWallet.toLowerCase());
      return {
        ...i,
        requesterDisplayName: requester?.displayName ?? null,
        requesterUsername: requester?.username ?? null,
        requesterProfileImage: requester?.profileImage ?? null,
        creatorDisplayName: creator?.displayName ?? null,
        creatorUsername: creator?.username ?? null,
        creatorProfileImage: creator?.profileImage ?? null,
      };
    }),
  });
}

export async function fulfillSocialReplyRecord(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as SocialReplyFulfillBody;
  const requestId = requireHex32(body.requestId, 'requestId');
  const creatorWallet = requireAddress(body.creatorWallet, 'creatorWallet').toLowerCase();
  const creatorReply = requireString(body.creatorReply, 'creatorReply', { max: 5_000 });
  const fulfillTxHash = requireTxHash(body.fulfillTxHash, 'fulfillTxHash');
  const commentId = requireUintString(body.commentId, 'commentId');

  const row = await SocialReply.findOne({ requestId });
  if (!row) throw notFound('Social reply request not found');
  if (row.creatorWallet !== creatorWallet) {
    throw badRequest('Only post creator can fulfill this request');
  }
  if (row.status !== 'pending') {
    throw conflict(`Request is already ${row.status}`);
  }

  row.status = 'responded';
  row.creatorReply = creatorReply;
  row.commentId = commentId;
  row.fulfillTxHash = fulfillTxHash;
  await row.save();
  res.json(row.toJSON());
}
