import type { Request, Response } from 'express';
import CreatorSubscriptionPlan from '../models/CreatorSubscriptionPlan';
import SubscriptionAccess from '../models/SubscriptionAccess';
import { badRequest, conflict } from '../utils/errors';
import { requireAddress, requireTxHash } from '../utils/validation';
import * as web3Service from '../services/web3Service';

interface UpsertOnlySnapsPlanBody {
  creatorWallet?: string;
  monthlyPriceWei?: string;
  txHash?: string;
}

interface RecordOnlySnapsSubscriptionBody {
  creatorWallet?: string;
  subscriberWallet?: string;
  txHash?: string;
  expectedAmountWei?: string;
}

function requireUintString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw badRequest(`${fieldName} must be a decimal uint string`);
  }
  return value;
}

export async function getOnlySnapsPlan(req: Request, res: Response): Promise<void> {
  const creator = requireAddress(req.params.creatorWallet, 'creatorWallet').toLowerCase();
  const row = await CreatorSubscriptionPlan.findOne({ creatorWallet: creator }).lean();
  res.json({
    creatorWallet: creator,
    monthlyPriceWei: row?.monthlyPriceWei ?? null,
    updatedAt: row?.updatedAt ?? null,
    updatedTxHash: row?.updatedTxHash ?? null,
  });
}

export async function upsertOnlySnapsPlan(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as UpsertOnlySnapsPlanBody;
  const creatorWallet = requireAddress(body.creatorWallet, 'creatorWallet').toLowerCase();
  const monthlyPriceWei = requireUintString(body.monthlyPriceWei, 'monthlyPriceWei');
  const txHash = body.txHash ? requireTxHash(body.txHash, 'txHash') : undefined;
  if (monthlyPriceWei === '0') throw badRequest('monthlyPriceWei must be > 0');

  const row = await CreatorSubscriptionPlan.findOneAndUpdate(
    { creatorWallet },
    { creatorWallet, monthlyPriceWei, updatedTxHash: txHash },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.status(201).json(row.toJSON());
}

export async function recordOnlySnapsSubscription(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as RecordOnlySnapsSubscriptionBody;
  const creatorWallet = requireAddress(body.creatorWallet, 'creatorWallet').toLowerCase();
  const subscriberWallet = requireAddress(body.subscriberWallet, 'subscriberWallet').toLowerCase();
  const txHash = requireTxHash(body.txHash, 'txHash');
  const expectedAmountWei = body.expectedAmountWei
    ? requireUintString(body.expectedAmountWei, 'expectedAmountWei')
    : undefined;
  if (creatorWallet === subscriberWallet) {
    throw badRequest('subscriberWallet cannot equal creatorWallet');
  }

  const txUsed = await SubscriptionAccess.findOne({ latestTxHash: txHash }).lean();
  if (txUsed) throw conflict('txHash already recorded');

  const verified = await web3Service.verifyOnlySnapsSubscribedEvent({
    txHash,
    creator: creatorWallet,
    subscriber: subscriberWallet,
    expectedAmountWei,
  });

  const plan = await CreatorSubscriptionPlan.findOne({ creatorWallet }).lean();
  if (!plan || plan.monthlyPriceWei !== verified.amountWei) {
    await CreatorSubscriptionPlan.findOneAndUpdate(
      { creatorWallet },
      {
        creatorWallet,
        monthlyPriceWei: verified.amountWei,
        updatedTxHash: txHash,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const access = await SubscriptionAccess.findOneAndUpdate(
    { creatorWallet, subscriberWallet },
    {
      creatorWallet,
      subscriberWallet,
      expiresAt: new Date(verified.periodEnd * 1000),
      currentPeriodStart: new Date(verified.periodStart * 1000),
      currentPeriodEnd: new Date(verified.periodEnd * 1000),
      latestAmountWei: verified.amountWei,
      latestTxHash: txHash,
      $inc: { renewalsCount: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(201).json({
    creatorWallet,
    subscriberWallet,
    amountWei: verified.amountWei,
    periodStart: verified.periodStart,
    periodEnd: verified.periodEnd,
    expiresAt: access.expiresAt,
    renewalsCount: access.renewalsCount,
    txHash,
  });
}

export async function getOnlySnapsStatus(req: Request, res: Response): Promise<void> {
  const creatorWallet = requireAddress(req.query.creatorWallet, 'creatorWallet').toLowerCase();
  const viewerWallet = requireAddress(req.query.viewerWallet, 'viewerWallet').toLowerCase();

  const [plan, access, activeSubscribers] = await Promise.all([
    CreatorSubscriptionPlan.findOne({ creatorWallet }).lean(),
    SubscriptionAccess.findOne({ creatorWallet, subscriberWallet: viewerWallet }).lean(),
    SubscriptionAccess.countDocuments({ creatorWallet, expiresAt: { $gt: new Date() } }),
  ]);

  const nowTs = Date.now();
  const expiresAtMs = access?.expiresAt ? new Date(access.expiresAt).getTime() : null;
  const isActive = viewerWallet === creatorWallet || (expiresAtMs !== null && expiresAtMs > nowTs);

  res.json({
    creatorWallet,
    viewerWallet,
    monthlyPriceWei: plan?.monthlyPriceWei ?? null,
    expiresAt: access?.expiresAt ?? null,
    isActive,
    activeSubscribers,
  });
}
