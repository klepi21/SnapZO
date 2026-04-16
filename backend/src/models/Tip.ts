import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface ITip {
  _id?: Types.ObjectId;
  post: Types.ObjectId;
  fromWallet: string;
  amount: number;
  message?: string;
  txHash: string;
  createdAt: Date;
}

const tipSchema = new Schema<ITip>(
  {
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    fromWallet: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    message: { type: String, trim: true, maxlength: 280 },
    txHash: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    createdAt: { type: Date, default: Date.now, index: -1 },
  },
  { versionKey: false }
);

tipSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    return r;
  },
});

export type TipDoc = HydratedDocument<ITip>;
export const Tip = model<ITip>('Tip', tipSchema);
export default Tip;
