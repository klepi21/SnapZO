import { Schema, model, type HydratedDocument } from 'mongoose';

export interface ISubscriptionAccess {
  creatorWallet: string;
  subscriberWallet: string;
  expiresAt: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  latestAmountWei?: string;
  latestTxHash?: string;
  renewalsCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const subscriptionAccessSchema = new Schema<ISubscriptionAccess>(
  {
    creatorWallet: { type: String, required: true, lowercase: true, trim: true, index: true },
    subscriberWallet: { type: String, required: true, lowercase: true, trim: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    latestAmountWei: { type: String, trim: true },
    latestTxHash: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    renewalsCount: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false }
);

subscriptionAccessSchema.index({ creatorWallet: 1, subscriberWallet: 1 }, { unique: true });

subscriptionAccessSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    return r;
  },
});

export type SubscriptionAccessDoc = HydratedDocument<ISubscriptionAccess>;
export const SubscriptionAccess = model<ISubscriptionAccess>('SubscriptionAccess', subscriptionAccessSchema);
export default SubscriptionAccess;
