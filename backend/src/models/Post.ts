import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface IPost {
  _id?: Types.ObjectId;
  postId: string;
  creatorWallet: string;
  content?: string;
  ipfsHash?: string;
  isLocked: boolean;
  unlockPrice: number;
  blurImage?: string;
  totalTips: number;
  createdAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    postId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    creatorWallet: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
      validate: {
        validator: (v: string) => /^0x[a-f0-9]{40}$/.test(v),
        message: 'creatorWallet must be a 0x-prefixed 20-byte hex address',
      },
    },
    content: { type: String, default: '', maxlength: 5_000 },
    ipfsHash: { type: String, trim: true },
    isLocked: { type: Boolean, default: true, index: true },
    unlockPrice: { type: Number, default: 0, min: 0 },
    blurImage: { type: String, trim: true },
    totalTips: { type: Number, default: 0, min: 0 },
    createdAt: { type: Date, default: Date.now, index: -1 },
  },
  { versionKey: false }
);

postSchema.index({ creatorWallet: 1, createdAt: -1 });

postSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    return r;
  },
});

export type PostDoc = HydratedDocument<IPost>;
export const Post = model<IPost>('Post', postSchema);
export default Post;
