import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export const SOCIAL_REPLY_STATUS = ['pending', 'responded', 'refunded'] as const;
export type SocialReplyStatus = (typeof SOCIAL_REPLY_STATUS)[number];

export interface ISocialReply {
  _id?: Types.ObjectId;
  post: Types.ObjectId;
  requestId: string;
  socialPostId: string;
  requesterWallet: string;
  creatorWallet: string;
  stakeAmountWei: string;
  requestTxHash: string;
  requesterComment: string;
  status: SocialReplyStatus;
  creatorReply?: string;
  commentId?: string;
  fulfillTxHash?: string;
  refundTxHash?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const socialReplySchema = new Schema<ISocialReply>(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    requestId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    socialPostId: { type: String, required: true, trim: true },
    requesterWallet: { type: String, required: true, lowercase: true, trim: true, index: true },
    creatorWallet: { type: String, required: true, lowercase: true, trim: true, index: true },
    stakeAmountWei: { type: String, required: true, trim: true },
    requestTxHash: { type: String, required: true, lowercase: true, trim: true },
    requesterComment: { type: String, required: true, trim: true, maxlength: 5_000 },
    status: {
      type: String,
      enum: SOCIAL_REPLY_STATUS as unknown as string[],
      default: 'pending',
      index: true,
    },
    creatorReply: { type: String, trim: true, maxlength: 5_000 },
    commentId: { type: String, trim: true },
    fulfillTxHash: { type: String, lowercase: true, trim: true },
    refundTxHash: { type: String, lowercase: true, trim: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false }
);

socialReplySchema.index({ post: 1, createdAt: 1 });

socialReplySchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    return r;
  },
});

export type SocialReplyDoc = HydratedDocument<ISocialReply>;
export const SocialReply = model<ISocialReply>('SocialReply', socialReplySchema);
export default SocialReply;
