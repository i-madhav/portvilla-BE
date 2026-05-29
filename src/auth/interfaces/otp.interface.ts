import { Document, Types } from 'mongoose';

// ─── Domain Enums ─────────────────────────────────────────────────────────────

export enum OtpPurpose {
  EMAIL_VERIFICATION = 'email_verification',
  LOGIN = 'login',
}

// ─── Schema Shape ─────────────────────────────────────────────────────────────

export interface IOtp {
  email: string;
  otpHash: string;
  purpose: OtpPurpose;
  /** TTL field — MongoDB auto-deletes the document at this timestamp. */
  expiresAt: Date;
  createdAt: Date;
}

// ─── Mongoose Document ────────────────────────────────────────────────────────
// Consumed ONLY inside OtpRepository. Never exposed to the service layer.

export type OtpDocument = IOtp & Document<Types.ObjectId>;

// ─── Service-layer Record ─────────────────────────────────────────────────────

export interface IOtpRecord {
  id: string;
  email: string;
  otpHash: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  createdAt: Date;
}
