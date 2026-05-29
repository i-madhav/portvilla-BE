import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  IOtpRepository,
  UpsertOtpData,
} from '../../domain/otp-repository.interface';
import { IOtpRecord, OtpDocument, OtpPurpose } from '../../interfaces/otp.interface';

export const OTP_MODEL = 'Otp';

@Injectable()
export class OtpRepository implements IOtpRepository {
  constructor(
    @InjectModel(OTP_MODEL) private readonly otpModel: Model<OtpDocument>,
  ) {}

  async upsert(data: UpsertOtpData): Promise<IOtpRecord> {
    // Replace any existing OTP for the same email + purpose to prevent
    // accumulation of stale codes when users request multiple OTPs.
    const doc = await this.otpModel
      .findOneAndReplace(
        { email: data.email.toLowerCase(), purpose: data.purpose },
        { ...data, email: data.email.toLowerCase() },
        { upsert: true, new: true },
      )
      .exec();

    if (!doc) {
      throw new Error('OTP upsert returned null unexpectedly');
    }
    return this.toRecord(doc);
  }

  async findLatest(email: string, purpose: OtpPurpose): Promise<IOtpRecord | null> {
    const doc = await this.otpModel
      .findOne({ email: email.toLowerCase(), purpose })
      .sort({ createdAt: -1 })
      .exec();
    return doc ? this.toRecord(doc) : null;
  }

  async deleteByEmailAndPurpose(email: string, purpose: OtpPurpose): Promise<void> {
    await this.otpModel
      .deleteMany({ email: email.toLowerCase(), purpose })
      .exec();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private toRecord(doc: OtpDocument): IOtpRecord {
    return {
      id: (doc._id as Types.ObjectId).toString(),
      email: doc.email,
      otpHash: doc.otpHash,
      purpose: doc.purpose,
      expiresAt: doc.expiresAt,
      createdAt: doc.createdAt,
    };
  }
}
