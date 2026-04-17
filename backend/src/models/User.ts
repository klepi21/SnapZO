import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface IUser {
  _id?: Types.ObjectId;
  walletAddress: string;
  displayName?: string;
  username?: string;
  bio?: string;
  profileImage?: string; // IPFS CID
  createdAt: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      validate: {
        validator: (v: string) => /^0x[a-f0-9]{40}$/.test(v),
        message: 'walletAddress must be a 0x-prefixed 20-byte hex address',
      },
    },
    displayName: { type: String, trim: true, maxlength: 64 },
    username: { type: String, trim: true, maxlength: 32 },
    bio: { type: String, trim: true, maxlength: 280 },
    profileImage: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date },
  },
  { versionKey: false }
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    return r;
  },
});

export type UserDoc = HydratedDocument<IUser>;
export const User = model<IUser>('User', userSchema);
export default User;
