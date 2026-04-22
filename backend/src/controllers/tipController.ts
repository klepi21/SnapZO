import type { Request, Response } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import Post from '../models/Post';
import Tip from '../models/Tip';
import * as web3Service from '../services/web3Service';
import { badRequest, notFound, conflict } from '../utils/errors';
import { requireAddress, requireTxHash, requirePositiveNumber } from '../utils/validation';

interface TipBody {
  postId?: string;
  fromWallet?: string;
  amount?: number | string;
  txHash?: string;
  message?: string;
}

/**
 * POST /api/tip — verify the on-chain MUSD transfer and persist.
 */
export async function createTip(req: Request, res: Response): Promise<void> {
  const { postId, fromWallet, amount, txHash, message } = (req.body ?? {}) as TipBody;
  if (!postId) throw badRequest('postId is required');

  const wallet = requireAddress(fromWallet, 'fromWallet').toLowerCase();
  const hash = requireTxHash(txHash);
  const amt = requirePositiveNumber(amount, 'amount');

  const post = await Post.findOne({ postId });
  if (!post) throw notFound('Post not found');

  if (wallet === post.creatorWallet) {
    throw badRequest('You cannot tip your own post');
  }

  const existing = await Tip.findOne({ txHash: hash }).lean();
  if (existing) throw conflict('txHash already used for a tip');

  try {
    await web3Service.verifyMusdTransfer({
      txHash: hash,
      from: wallet,
      to: post.creatorWallet,
      amount: amt,
    });
  } catch {
    await web3Service.verifySocialTipEvent({
      txHash: hash,
      tipper: wallet,
      creator: post.creatorWallet,
    });
  }

  const tip = await Tip.create({
    post: post._id,
    fromWallet: wallet,
    amount: amt,
    message: typeof message === 'string' ? message.slice(0, 280) : undefined,
    txHash: hash,
  });

  await Post.updateOne({ _id: post._id }, { $inc: { totalTips: amt } });

  const io = req.app.get('io') as SocketIOServer | undefined;
  if (io) {
    io.to(`post:${post.postId}`).emit('post:tipped', {
      postId: post.postId,
      amount: amt,
      from: wallet,
      message: tip.message,
    });
    io.to(`creator:${post.creatorWallet}`).emit('tip:received', {
      postId: post.postId,
      amount: amt,
      from: wallet,
    });
  }

  res.status(201).json(tip.toJSON());
}
