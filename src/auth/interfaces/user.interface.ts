import { Document, Types } from 'mongoose';

// ─── Domain Enums ─────────────────────────────────────────────────────────────

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

// ─── Schema Shape ─────────────────────────────────────────────────────────────
// Describes the raw fields stored in MongoDB. Used by the Mongoose schema
// definition and as the basis for the Document and Record types below.

export interface IUser {
  email: string;
  passwordHash: string;
  isEmailVerified: boolean;
  role: UserRole;
  /** Bcrypt hash of the current refresh token; null after logout. */
  refreshTokenHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mongoose Document ────────────────────────────────────────────────────────
// Includes all Mongoose Document methods (save, populate, etc.).
// Returned directly by the Mongoose model — consumed ONLY inside repositories.
// The service layer must never receive or import this type.

export type UserDocument = IUser & Document<Types.ObjectId>;

// ─── Service-layer Record ─────────────────────────────────────────────────────
// A plain, serialisable object that the service layer works with.
// The repository strips Mongoose internals and exposes `id` as a plain string.
// Nothing beyond this type should leak into AuthService or higher layers.

export interface IUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  isEmailVerified: boolean;
  role: UserRole;
  refreshTokenHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}
