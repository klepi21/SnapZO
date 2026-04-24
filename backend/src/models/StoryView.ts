import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface IStoryView {
  _id?: Types.ObjectId;
  story: Types.ObjectId;
  viewerWallet: string;
  seenAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const storyViewSchema = new Schema<IStoryView>(
  {
    story: { type: Schema.Types.ObjectId, ref: 'Story', required: true, index: true },
    viewerWallet: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
      validate: {
        validator: (v: string) => /^0x[a-f0-9]{40}$/.test(v),
        message: 'viewerWallet must be a 0x-prefixed 20-byte hex address',
      },
    },
    seenAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true, versionKey: false }
);

storyViewSchema.index({ story: 1, viewerWallet: 1 }, { unique: true });

storyViewSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    return r;
  },
});

export type StoryViewDoc = HydratedDocument<IStoryView>;
export const StoryView = model<IStoryView>('StoryView', storyViewSchema);
export default StoryView;
