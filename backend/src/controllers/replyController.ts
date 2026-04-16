import type { Request, Response } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import Post, { type IPost } from '../models/Post';
import Reply from '../models/Reply';
import config from '../config';
import * as ipfsService from '../services/ipfsService';
import * as web3Service from '../services/web3Service';
import * as cronService from '../services/cronService';
import { badRequest, notFound, conflict } from '../utils/errors';
import {
  requireAddress,
  requireString,
  requireTxHash,
  requirePositiveNumber,
} from '../utils/validation';

interface ReplyRequestBody {
  postId?: string;
  requesterWallet?: string;
  amount?: number | string;
  txHash?: string;
}

interface ReplyRespondBody {
  replyId?: string;
  creatorWallet?: string;
  replyContent?: string;
  replyMediaBase64?: string;
  replyMediaName?: string;
  replyMediaMimeType?: string;
}

interface ReplyRefundBody {
  replyId?: string;
}

/**
 * POST /api/reply/request — create a pending reply (escrow).
 */
export async function requestReply(req: Request, res: Response): Promise<void> {
  const { postId, requesterWallet, amount, txHash } = (req.body ?? {}) as ReplyRequestBody;
  if (!postId) throw badRequest('postId is required');

  const wallet = requireAddress(requesterWallet, 'requesterWallet').toLowerCase();
  const hash = requireTxHash(txHash);
  const amt = requirePositiveNumber(amount, 'amount');

  const post = await Post.findOne({ postId });
  if (!post) throw notFound('Post not found');

  if (wallet === post.creatorWallet) {
    throw badRequest('You cannot pay-to-reply on your own post');
  }

  const escrow = web3Service.getEscrowAddress();
  if (!escrow) throw badRequest('Server escrow wallet is not configured');

  const existing = await Reply.findOne({ txHash: hash }).lean();
  if (existing) throw conflict('txHash already used for a reply');

  await web3Service.verifyMusdTransfer({
    txHash: hash,
    from: wallet,
    to: escrow,
    amount: amt,
  });

  const deadline = new Date(Date.now() + config.reply.windowHours * 3600 * 1000);

  const reply = await Reply.create({
    post: post._id,
    requesterWallet: wallet,
    amount: amt,
    txHash: hash,
    status: 'pending',
    deadline,
  });

  const io = req.app.get('io') as SocketIOServer | undefined;
  io?.to(`creator:${post.creatorWallet}`).emit('reply:pending', {
    replyId: String(reply._id),
    postId: post.postId,
    requester: wallet,
    amount: amt,
    deadline,
  });

  res.status(201).json(reply.toJSON());
}

/**
 * GET /api/reply/pending?creatorWallet=0x... — list pending replies for creator.
 */
export async function getPendingReplies(req: Request, res: Response): Promise<void> {
  const wallet = requireAddress(req.query.creatorWallet, 'creatorWallet').toLowerCase();

  const posts = await Post.find({ creatorWallet: wallet }).select('_id postId content').lean();
  if (posts.length === 0) {
    res.json({ items: [] });
    return;
  }

  const postIdMap = new Map(posts.map((p) => [String(p._id), p]));
  const items = await Reply.find({
    post: { $in: posts.map((p) => p._id) },
    status: 'pending',
  })
    .sort({ deadline: 1 })
    .lean();

  res.json({
    items: items.map((r) => ({
      id: String(r._id),
      post: String(r.post),
      postId: postIdMap.get(String(r.post))?.postId,
      requesterWallet: r.requesterWallet,
      amount: r.amount,
      txHash: r.txHash,
      deadline: r.deadline,
      createdAt: (r as { createdAt?: Date }).createdAt,
    })),
  });
}

/**
 * POST /api/reply/respond — creator responds to a pending reply.
 */
export async function respondReply(req: Request, res: Response): Promise<void> {
  const {
    replyId,
    creatorWallet,
    replyContent,
    replyMediaBase64,
    replyMediaName,
    replyMediaMimeType,
  } = (req.body ?? {}) as ReplyRespondBody;

  if (!replyId) throw badRequest('replyId is required');
  const wallet = requireAddress(creatorWallet, 'creatorWallet').toLowerCase();
  const text = requireString(replyContent, 'replyContent', { max: 5000 });

  const reply = await Reply.findById(replyId).populate<{ post: IPost }>('post');
  if (!reply) throw notFound('Reply not found');
  if (!reply.post) throw notFound('Underlying post not found');

  const post = reply.post as unknown as IPost;

  if (post.creatorWallet !== wallet) {
    throw badRequest('Only the post creator can respond to this reply');
  }
  if (reply.status !== 'pending') {
    throw conflict(`Reply is already ${reply.status}`);
  }
  if (reply.deadline.getTime() <= Date.now()) {
    throw conflict('Reply deadline has passed; user can claim refund');
  }

  let replyIpfsHash: string | undefined;
  if (replyMediaBase64) {
    replyIpfsHash = await ipfsService.uploadFile({
      data: replyMediaBase64,
      name: replyMediaName ?? 'reply.bin',
      mimeType: replyMediaMimeType ?? 'application/octet-stream',
    });
  }

  reply.replyContent = text;
  reply.replyIpfsHash = replyIpfsHash;
  reply.respondedAt = new Date();
  reply.status = 'responded';
  await reply.save();

  const io = req.app.get('io') as SocketIOServer | undefined;
  io?.to(`requester:${reply.requesterWallet}`).emit('reply:responded', {
    replyId: String(reply._id),
    postId: post.postId,
    replyContent: text,
    replyIpfsHash,
    respondedAt: reply.respondedAt,
  });

  res.json(reply.toJSON());
}

/**
 * POST /api/reply/refund — manual refund when past deadline.
 */
export async function refundReply(req: Request, res: Response): Promise<void> {
  const { replyId } = (req.body ?? {}) as ReplyRefundBody;
  if (!replyId) throw badRequest('replyId is required');

  const reply = await Reply.findById(replyId);
  if (!reply) throw notFound('Reply not found');
  if (reply.status !== 'pending') {
    throw conflict(`Reply is already ${reply.status}`);
  }
  if ((reply.deadline as Date).getTime() > Date.now()) {
    throw badRequest('Refund not yet available — deadline has not passed');
  }

  const txHash = await web3Service.sendMusdRefund({
    to: reply.requesterWallet,
    amount: reply.amount,
  });

  reply.status = 'refunded';
  reply.refundTxHash = txHash;
  await reply.save();

  const io = req.app.get('io') as SocketIOServer | undefined;
  io?.to(`requester:${reply.requesterWallet}`).emit('reply:refunded', {
    replyId: String(reply._id),
    postId: String(reply.post),
    amount: reply.amount,
    refundTxHash: txHash,
  });

  res.json(reply.toJSON());
}

/** Manual cron-pass trigger (admin / debug). */
export async function runRefundPass(_req: Request, res: Response): Promise<void> {
  const result = await cronService.processExpiredReplies();
  res.json(result);
}
