import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';

import { MailModule } from '../mail/mail.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { USER_REPOSITORY } from './domain/user-repository.interface';
import { OTP_REPOSITORY } from './domain/otp-repository.interface';

import {
  UserRepository,
} from './infrastructure/repository/user.repository';
import {
  OtpRepository
} from './infrastructure/repository/otp.repository';

import { UserSchema } from './infrastructure/scehma/user.schema';
import { OtpSchema } from './infrastructure/scehma/otp.schema';

import { JwtStrategy } from './strategies/jwt.strategy';
import { DB_MODEL_REGISTRY, DbModelToken } from '../shared/mongoose/modelRegistry/mongoose.modelRegistry';

@Module({
  imports: [
    PassportModule,
    // JwtModule is registered without a default secret; each signAsync call
    // in AuthService supplies its own secret and expiry explicitly.
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: DB_MODEL_REGISTRY.USER.MODEL_TOKEN as DbModelToken, schema: UserSchema },
      { name: DB_MODEL_REGISTRY.OTP.MODEL_TOKEN as DbModelToken, schema: OtpSchema },
    ]),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Bind the infrastructure implementations to their domain interface tokens.
    // Anything that needs IUserRepository or IOtpRepository injects the token;
    // the concrete Mongoose class is an implementation detail of this module.
    { provide: USER_REPOSITORY, useClass: UserRepository },
    { provide: OTP_REPOSITORY, useClass: OtpRepository },
  ],
  // Export the token so other modules can inject IUserRepository if needed.
  exports: [USER_REPOSITORY],
})
export class AuthModule {}
