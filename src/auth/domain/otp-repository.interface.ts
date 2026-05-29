import type { IOtpRecord, OtpPurpose } from '../interfaces/otp.interface';

export const OTP_REPOSITORY = Symbol('IOtpRepository');

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface UpsertOtpData {
  email: string;
  otpHash: string;
  purpose: OtpPurpose;
  expiresAt: Date;
}

// ─── Repository Interface ─────────────────────────────────────────────────────

export interface IOtpRepository {
  upsert(data: UpsertOtpData): Promise<IOtpRecord>;
  findLatest(email: string, purpose: OtpPurpose): Promise<IOtpRecord | null>;
  deleteByEmailAndPurpose(email: string, purpose: OtpPurpose): Promise<void>;
}
