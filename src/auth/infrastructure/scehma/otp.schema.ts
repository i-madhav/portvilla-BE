import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IOtp, OtpPurpose } from '../../interfaces/otp.interface';

@Schema({ timestamps: true, collection: 'otps' })
class Otp implements IOtp {
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  otpHash: string;

  @Prop({ required: true, enum: OtpPurpose })
  purpose: OtpPurpose;

  @Prop({ required: true })
  expiresAt: Date;

  createdAt: Date;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);

// MongoDB TTL index: the server deletes expired OTP documents automatically.
// The application also validates `expiresAt` before trusting any OTP.
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Lookup by email + purpose is the only query pattern used.
OtpSchema.index({ email: 1, purpose: 1 });
