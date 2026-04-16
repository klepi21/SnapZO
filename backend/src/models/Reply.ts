import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export const REPLY_STATUS = ['pending', 'responded', 'refunded'] as const;
export type ReplyStatus = (typeof REPLY_STATUS)[number];

export interface IReply {
  _id?: Types.ObjectId;
  post: Types.ObjectId;
  requesterWallet: string;
  amount: number;
  txHash: string;
  status: ReplyStatus;
  deadline: Date;
  replyContent?: string;
  replyIpfsHash?: string;
  respondedAt?: Date;
  refundTxHash?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const replySchema = new Schema<IReply>(
  {
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    requesterWallet: {
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
    status: {
      type: String,
      enum: REPLY_STATUS as unknown as string[],
      default: 'pending',
      index: true,
    },
    deadline: { type: Date, required: true, index: true },
    replyContent: { type: String, trim: true, maxlength: 5_000 },
    replyIpfsHash: { type: String, trim: true },
    respondedAt: { type: Date },
    refundTxHash: { type: String, lowercase: true, trim: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false }
);

// Helps cron query "pending replies past deadline" efficiently.
replySchema.index({ status: 1, deadline: 1 });

replySchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    return r;
  },
});

export type ReplyDoc = HydratedDocument<IReply>;
export const Reply = model<IReply>('Reply', replySchema);
export default Reply;
