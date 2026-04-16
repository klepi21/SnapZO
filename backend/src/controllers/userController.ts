import type { Request, Response } from 'express';
import User from '../models/User';
import Post from '../models/Post';
import { requireAddress } from '../utils/validation';

/**
 * GET /api/user/:wallet — user profile (auto-created if missing) + posts.
 */
export async function getUser(req: Request, res: Response): Promise<void> {
  const wallet = requireAddress(req.params.wallet, 'wallet').toLowerCase();

  let user = await User.findOne({ walletAddress: wallet });
  if (!user) {
    user = await User.create({ walletAddress: wallet });
  }

  const posts = await Post.find({ creatorWallet: wallet })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json({
    user: user.toJSON(),
    posts: posts.map((p) => ({
      id: String(p._id),
      postId: p.postId,
      creatorWallet: p.creatorWallet,
      content: p.content,
      ipfsHash: p.ipfsHash,
      isLocked: p.isLocked,
      unlockPrice: p.unlockPrice,
      blurImage: p.blurImage,
      totalTips: p.totalTips,
      createdAt: p.createdAt,
    })),
  });
}
