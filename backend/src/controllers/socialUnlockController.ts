import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import Post from '../models/Post';
import SocialUnlock from '../models/SocialUnlock';
import { badRequest, conflict, notFound } from '../utils/errors';
import { requireAddress, requireTxHash } from '../utils/validation';

interface SocialUnlockBody {
  postObjectId?: string;
  userWallet?: string;
  txHash?: string;
  amountWei?: string;
}

function requireUintString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw badRequest(`${fieldName} must be a decimal uint string`);
  }
  return value;
}

export async function createSocialUnlockRecord(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as SocialUnlockBody;
  if (!body.postObjectId || !Types.ObjectId.isValid(body.postObjectId)) {
    throw badRequest('postObjectId must be a valid post id');
  }
  const post = await Post.findById(body.postObjectId).lean();
  if (!post) throw notFound('Post not found');
  const userWallet = requireAddress(body.userWallet, 'userWallet').toLowerCase();
  const txHash = requireTxHash(body.txHash, 'txHash');
  const amountWei = requireUintString(body.amountWei, 'amountWei');

  const existing = await SocialUnlock.findOne({
    post: new Types.ObjectId(body.postObjectId),
    userWallet,
  }).lean();
  if (existing) throw conflict('User has already unlocked this post');

  const row = await SocialUnlock.create({
    post: new Types.ObjectId(body.postObjectId),
    userWallet,
    txHash,
    amountWei,
  });
  res.status(201).json(row.toJSON());
}
