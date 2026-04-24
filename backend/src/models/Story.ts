import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface IStory {
  _id?: Types.ObjectId;
  creatorWallet: string;
  ipfsHash: string;
  createdAt: Date;
  expiresAt: Date;
}

const storySchema = new Schema<IStory>(
  {
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
    ipfsHash: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now, index: -1 },
    expiresAt: { type: Date, required: true, index: true },
  },
  { versionKey: false }
);

// Auto-delete expired stories.
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ creatorWallet: 1, createdAt: -1 });

storySchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    return r;
  },
});

export type StoryDoc = HydratedDocument<IStory>;
export const Story = model<IStory>('Story', storySchema);
export default Story;
