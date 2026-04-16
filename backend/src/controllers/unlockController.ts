import type { Request, Response } from 'express';
import Post from '../models/Post';
import Unlock from '../models/Unlock';
import * as web3Service from '../services/web3Service';
import { badRequest, notFound, conflict } from '../utils/errors';
import { requireAddress, requireTxHash, requirePositiveNumber } from '../utils/validation';

interface UnlockBody {
  postId?: string;
  userWallet?: string;
  txHash?: string;
  amount?: number | string;
}

/**
 * POST /api/unlock — verify the on-chain MUSD transfer and persist.
 * Body: { postId, userWallet, txHash, amount }
 */
export async function createUnlock(req: Request, res: Response): Promise<void> {
  const { postId, userWallet, txHash, amount } = (req.body ?? {}) as UnlockBody;
  if (!postId) throw badRequest('postId is required');

  const wallet = requireAddress(userWallet, 'userWallet').toLowerCase();
  const hash = requireTxHash(txHash);
  const amt = requirePositiveNumber(amount, 'amount');

  const post = await Post.findOne({ postId });
  if (!post) throw notFound('Post not found');

  if (!post.isLocked) {
    throw badRequest('Post is not locked');
  }
  if (amt + 1e-9 < (post.unlockPrice ?? 0)) {
    throw badRequest(`amount must be >= post.unlockPrice (${post.unlockPrice})`);
  }

  const existingTx = await Unlock.findOne({ txHash: hash }).lean();
  if (existingTx) throw conflict('txHash already used for an unlock');

  const existingUnlock = await Unlock.findOne({ post: post._id, userWallet: wallet }).lean();
  if (existingUnlock) throw conflict('User has already unlocked this post');

  await web3Service.verifyMusdTransfer({
    txHash: hash,
    from: wallet,
    to: post.creatorWallet,
    amount: amt,
  });

  const unlock = await Unlock.create({
    post: post._id,
    userWallet: wallet,
    amount: amt,
    txHash: hash,
  });

  res.status(201).json({
    unlock: unlock.toJSON(),
    ipfsHash: post.ipfsHash,
  });
}
