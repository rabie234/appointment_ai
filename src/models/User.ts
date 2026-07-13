import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, type Role } from '@/lib/roles';

const SALT_ROUNDS = 10;

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // never returned unless explicitly .select('+password')
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'patient',
      // Guards against mass-assignment: role can only be changed by explicitly
      // setting it on a document, never via a create/update payload spread.
      immutable: false,
    },
    phone: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Hash here rather than at the call site, so *every* write path (seed script,
// future password-reset, admin tooling) is covered and cannot store plaintext.
// Mongoose 9's `pre` overloads need the `this` type pinned explicitly,
// otherwise it resolves the signature to SaveOptions and errors.
UserSchema.pre('save', async function (this: IUser) {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
