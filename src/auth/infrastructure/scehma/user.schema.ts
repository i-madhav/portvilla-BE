import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IUser, UserRole } from '../../interfaces/user.interface';

@Schema({ timestamps: true, collection: 'users' })
class User implements IUser {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, default: false })
  isEmailVerified: boolean;

  @Prop({ required: true, enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Prop({ type: String, default: null })
  refreshTokenHash: string | null;

  // Provided by { timestamps: true } — declared here for type completeness.
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
// The unique: true on the email @Prop already creates the email index.
