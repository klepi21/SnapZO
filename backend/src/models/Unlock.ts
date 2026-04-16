import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface IUnlock {
  _id?: Types.ObjectId;
  post: Types.ObjectId;
  userWallet: string;
  amount: number;
  txHash: string;
  unlockedAt: Date;
}

const unlockSchema = new Schema<IUnlock>(
  {
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    userWallet: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    txHash: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    unlockedAt: { type: Date, default: Date.now, index: -1 },
  },
  { versionKey: false }
);

unlockSchema.index({ post: 1, userWallet: 1 }, { unique: true });

unlockSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    return r;
  },
});

export type UnlockDoc = HydratedDocument<IUnlock>;
export const Unlock = model<IUnlock>('Unlock', unlockSchema);
export default Unlock;
