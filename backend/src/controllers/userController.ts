import type { Request, Response } from 'express';
import User from '../models/User';
import Post from '../models/Post';
import Unlock from '../models/Unlock';
import SocialUnlock from '../models/SocialUnlock';
import * as ipfsService from '../services/ipfsService';
import { badRequest, notFound } from '../utils/errors';
import { requireAddress } from '../utils/validation';

/**
 * GET /api/users — list users with optional search + pagination.
 * Query: ?limit=50&offset=0&search=<substring>
 */
export async function listUsers(req: Request, res: Response): Promise<void> {
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);
  const search =
    typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const filter: Record<string, unknown> = {};
  if (search) {
    // Escape regex special chars before building the case-insensitive pattern.
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    filter.$or = [{ walletAddress: rx }, { username: rx }];
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  res.json({
    items: items.map((u) => ({
      id: String(u._id),
      walletAddress: u.walletAddress,
      username: u.username,
      bio: u.bio,
      profileImage: u.profileImage,
      createdAt: u.createdAt,
    })),
    total,
    limit,
    offset,
    nextOffset: offset + items.length < total ? offset + items.length : null,
  });
}

interface UpdateProfileBody {
  displayName?: string | null;
  username?: string | null;
  bio?: string | null;
  avatarBase64?: string | null;
  avatarMimeType?: string;
  avatarName?: string;
  profileImage?: string | null; // pre-uploaded IPFS CID (alternative to avatarBase64)
}

function sanitizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
}

/**
 * PATCH /api/user/:wallet — update profile fields.
 * Accepts any subset of { displayName, username, bio, avatarBase64 }.
 * If `avatarBase64` is provided, it is uploaded to IPFS and the returned
 * CID is stored as `profileImage`. Pass `null` on a field to clear it.
 */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const wallet = requireAddress(req.params.wallet, 'wallet').toLowerCase();
  const body = (req.body ?? {}) as UpdateProfileBody;

  const update: Record<string, unknown> = { updatedAt: new Date() };
  const unset: Record<string, ''> = {};

  if ('displayName' in body) {
    if (body.displayName === null || body.displayName === '') {
      unset.displayName = '';
    } else if (typeof body.displayName === 'string') {
      update.displayName = body.displayName.trim().slice(0, 64);
    } else {
      throw badRequest('displayName must be a string or null');
    }
  }

  if ('username' in body) {
    if (body.username === null || body.username === '') {
      unset.username = '';
    } else if (typeof body.username === 'string') {
      const clean = sanitizeUsername(body.username);
      if (!clean) throw badRequest('username must contain a-z, 0-9, or _');
      update.username = clean;
    } else {
      throw badRequest('username must be a string or null');
    }
  }

  if ('bio' in body) {
    if (body.bio === null || body.bio === '') {
      unset.bio = '';
    } else if (typeof body.bio === 'string') {
      update.bio = body.bio.trim().slice(0, 280);
    } else {
      throw badRequest('bio must be a string or null');
    }
  }

  // Avatar — two ways to clear / set:
  //   - avatarBase64: upload to IPFS, store CID
  //   - profileImage: pre-uploaded CID string
  //   - null on either: clear the field
  if ('avatarBase64' in body) {
    if (body.avatarBase64 === null || body.avatarBase64 === '') {
      unset.profileImage = '';
    } else if (typeof body.avatarBase64 === 'string') {
      const cid = await ipfsService.uploadFile({
        data: body.avatarBase64,
        name: body.avatarName ?? 'avatar.jpg',
        mimeType: body.avatarMimeType ?? 'image/jpeg',
      });
      update.profileImage = cid;
    } else {
      throw badRequest('avatarBase64 must be a string or null');
    }
  } else if ('profileImage' in body) {
    if (body.profileImage === null || body.profileImage === '') {
      unset.profileImage = '';
    } else if (typeof body.profileImage === 'string') {
      update.profileImage = body.profileImage.trim();
    } else {
      throw badRequest('profileImage must be a string or null');
    }
  }

  const ops: Record<string, unknown> = { $set: update };
  if (Object.keys(unset).length > 0) ops.$unset = unset;

  const user = await User.findOneAndUpdate({ walletAddress: wallet }, ops, {
    new: true,
  });
  if (!user) throw notFound('User not found');

  res.json(user.toJSON());
}

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

  const postIds = posts.map((p) => p._id);
  const [unlockRows, socialUnlockRows] =
    postIds.length > 0
      ? await Promise.all([
          Unlock.aggregate<{ _id: unknown; count: number }>([
            { $match: { post: { $in: postIds } } },
            { $group: { _id: '$post', count: { $sum: 1 } } },
          ]),
          SocialUnlock.aggregate<{ _id: unknown; count: number }>([
            { $match: { post: { $in: postIds } } },
            { $group: { _id: '$post', count: { $sum: 1 } } },
          ]),
        ])
      : [[], []];
  const unlockCountMap = new Map<string, number>();
  for (const row of unlockRows) {
    unlockCountMap.set(String(row._id), row.count);
  }
  for (const row of socialUnlockRows) {
    const k = String(row._id);
    unlockCountMap.set(k, (unlockCountMap.get(k) ?? 0) + row.count);
  }

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
      unlockCount: unlockCountMap.get(String(p._id)) ?? 0,
      createdAt: p.createdAt,
    })),
  });
}
