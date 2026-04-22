import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface ISocialUnlock {
  _id?: Types.ObjectId;
  post: Types.ObjectId;
  userWallet: string;
  txHash: string;
  amountWei: string;
  createdAt?: Date;
}

const socialUnlockSchema = new Schema<ISocialUnlock>(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    userWallet: { type: String, required: true, lowercase: true, trim: true, index: true },
    txHash: { type: String, required: true, unique: true, lowercase: true, trim: true },
    amountWei: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now, index: -1 },
  },
  { versionKey: false }
);

socialUnlockSchema.index({ post: 1, userWallet: 1 }, { unique: true });

socialUnlockSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    return r;
  },
});

export type SocialUnlockDoc = HydratedDocument<ISocialUnlock>;
export const SocialUnlock = model<ISocialUnlock>('SocialUnlock', socialUnlockSchema);
export default SocialUnlock;
