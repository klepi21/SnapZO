import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import User from '../models/User';
import Story from '../models/Story';
import StoryView from '../models/StoryView';
import * as ipfsService from '../services/ipfsService';
import { badRequest, notFound } from '../utils/errors';
import { requireAddress } from '../utils/validation';

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

interface CreateStoryBody {
  creatorWallet?: string;
  mediaBase64?: string;
  mediaName?: string;
  mediaMimeType?: string;
}

interface MarkStorySeenBody {
  viewerWallet?: string;
  storyId?: string;
}

export async function createStory(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as CreateStoryBody;
  const creatorWallet = requireAddress(body.creatorWallet, 'creatorWallet').toLowerCase();
  if (!body.mediaBase64 || typeof body.mediaBase64 !== 'string') {
    throw badRequest('mediaBase64 is required');
  }

  const ipfsHash = await ipfsService.uploadFile({
    data: body.mediaBase64,
    name: body.mediaName ?? 'story.jpg',
    mimeType: body.mediaMimeType ?? 'image/jpeg',
  });

  await User.updateOne(
    { walletAddress: creatorWallet },
    { $setOnInsert: { walletAddress: creatorWallet, createdAt: new Date() } },
    { upsert: true }
  );

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + STORY_TTL_MS);
  const story = await Story.create({
    creatorWallet,
    ipfsHash,
    createdAt,
    expiresAt,
  });

  res.status(201).json(story.toJSON());
}

export async function getStoriesFeed(req: Request, res: Response): Promise<void> {
  const viewerWalletRaw = req.query.viewerWallet;
  const viewerWallet =
    viewerWalletRaw !== undefined
      ? requireAddress(viewerWalletRaw, 'viewerWallet').toLowerCase()
      : null;
  const now = new Date();
  const stories = await Story.find({ expiresAt: { $gt: now } }).sort({ createdAt: 1 }).lean();
  if (stories.length === 0) {
    res.json({ items: [] });
    return;
  }

  const creatorWallets = [...new Set(stories.map((s) => s.creatorWallet.toLowerCase()))];
  const storyObjectIds = stories
    .map((s) => s._id)
    .filter((id): id is Types.ObjectId => Boolean(id));

  const [users, seenRows] = await Promise.all([
    User.find({ walletAddress: { $in: creatorWallets } })
      .select('walletAddress displayName username profileImage')
      .lean(),
    viewerWallet && storyObjectIds.length > 0
      ? StoryView.find({ viewerWallet, story: { $in: storyObjectIds } }).select('story').lean()
      : Promise.resolve([]),
  ]);

  const userMap = new Map(users.map((u) => [u.walletAddress.toLowerCase(), u]));
  const seenSet = new Set(seenRows.map((x) => String(x.story)));

  const grouped = new Map<
    string,
    {
      creatorWallet: string;
      creatorDisplayName: string | null;
      creatorUsername: string | null;
      creatorProfileImage: string | null;
      stories: Array<{
        id: string;
        ipfsHash: string;
        createdAt: Date;
        expiresAt: Date;
        seen: boolean;
      }>;
      latestCreatedAt: Date;
      hasUnseen: boolean;
    }
  >();

  for (const story of stories) {
    const creatorWallet = story.creatorWallet.toLowerCase();
    const existing = grouped.get(creatorWallet);
    const seen = seenSet.has(String(story._id));
    if (!existing) {
      const creator = userMap.get(creatorWallet);
      grouped.set(creatorWallet, {
        creatorWallet,
        creatorDisplayName: creator?.displayName ?? null,
        creatorUsername: creator?.username ?? null,
        creatorProfileImage: creator?.profileImage ?? null,
        stories: [
          {
            id: String(story._id),
            ipfsHash: story.ipfsHash,
            createdAt: story.createdAt,
            expiresAt: story.expiresAt,
            seen,
          },
        ],
        latestCreatedAt: story.createdAt,
        hasUnseen: !seen,
      });
      continue;
    }
    existing.stories.push({
      id: String(story._id),
      ipfsHash: story.ipfsHash,
      createdAt: story.createdAt,
      expiresAt: story.expiresAt,
      seen,
    });
    if (story.createdAt > existing.latestCreatedAt) {
      existing.latestCreatedAt = story.createdAt;
    }
    if (!seen) existing.hasUnseen = true;
  }

  const items = [...grouped.values()].sort((a, b) => {
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
    return b.latestCreatedAt.getTime() - a.latestCreatedAt.getTime();
  });

  res.json({ items });
}

export async function markStorySeen(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as MarkStorySeenBody;
  const viewerWallet = requireAddress(body.viewerWallet, 'viewerWallet').toLowerCase();
  if (!body.storyId || !Types.ObjectId.isValid(body.storyId)) {
    throw badRequest('storyId must be a valid object id');
  }

  const story = await Story.findById(body.storyId).select('_id expiresAt').lean();
  if (!story) throw notFound('story not found');
  if (story.expiresAt.getTime() <= Date.now()) {
    throw badRequest('story already expired');
  }

  const seenAt = new Date();
  await StoryView.findOneAndUpdate(
    { story: story._id, viewerWallet },
    { story: story._id, viewerWallet, seenAt },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(201).json({ ok: true });
}
