import type { Request, Response } from 'express';
import User from '../models/User';
import { requireAddress } from '../utils/validation';

interface LoginBody {
  walletAddress?: string;
}

interface MongoDuplicateKeyError {
  code?: number;
}

/**
 * POST /api/auth/login
 * Idempotent "login" / first-time registration for a wallet address.
 *
 *   - If the wallet is new → a minimal User row is created (`isNew: true`).
 *   - If the wallet already exists → nothing is written (`isNew: false`).
 *
 * Profile fields (username, bio, profileImage) are set later by the user
 * from their profile page, not here.
 *
 * No signature verification — this is "presence auth". For production,
 * swap in SIWE (Sign-In With Ethereum) with nonce + signature.
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { walletAddress } = (req.body ?? {}) as LoginBody;
  const wallet = requireAddress(walletAddress, 'walletAddress').toLowerCase();

  // Fast path: user already exists.
  const existing = await User.findOne({ walletAddress: wallet });
  if (existing) {
    res.status(200).json({ user: existing.toJSON(), isNew: false });
    return;
  }

  // First-time signup: create with just the wallet.
  try {
    const created = await User.create({ walletAddress: wallet });
    res.status(201).json({ user: created.toJSON(), isNew: true });
  } catch (err) {
    // Race: another concurrent request inserted the same wallet first.
    // The unique index on walletAddress returns duplicate-key (11000).
    if ((err as MongoDuplicateKeyError).code === 11000) {
      const winner = await User.findOne({ walletAddress: wallet });
      if (winner) {
        res.status(200).json({ user: winner.toJSON(), isNew: false });
        return;
      }
    }
    throw err;
  }
}
