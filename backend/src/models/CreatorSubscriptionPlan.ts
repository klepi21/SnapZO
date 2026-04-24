import { Schema, model, type HydratedDocument } from 'mongoose';

export interface ICreatorSubscriptionPlan {
  creatorWallet: string;
  monthlyPriceWei: string;
  updatedTxHash?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const creatorSubscriptionPlanSchema = new Schema<ICreatorSubscriptionPlan>(
  {
    creatorWallet: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
    monthlyPriceWei: { type: String, required: true, trim: true },
    updatedTxHash: { type: String, lowercase: true, trim: true },
  },
  { timestamps: true, versionKey: false }
);

creatorSubscriptionPlanSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    return r;
  },
});

export type CreatorSubscriptionPlanDoc = HydratedDocument<ICreatorSubscriptionPlan>;
export const CreatorSubscriptionPlan = model<ICreatorSubscriptionPlan>(
  'CreatorSubscriptionPlan',
  creatorSubscriptionPlanSchema
);
export default CreatorSubscriptionPlan;
