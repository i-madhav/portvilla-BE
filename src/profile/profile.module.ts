import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';

import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

import { PROFILE_REPOSITORY } from './domain/profile-repository.interface';
import {
  ProfileRepository,
  PROFILE_MODEL,
} from './infrastructure/repository/profile.repository';
import { ProfileSchema } from './infrastructure/schema/profile.schema';
import { ProfileOwnerGuard } from './guards/profile-owner.guard';

@Module({
  imports: [
    AuthModule,
    LlmModule,
    MongooseModule.forFeature([{ name: PROFILE_MODEL, schema: ProfileSchema }]),
  ],
  controllers: [ProfileController],
  providers: [
    ProfileService,
    { provide: PROFILE_REPOSITORY, useClass: ProfileRepository },
    ProfileOwnerGuard,
  ],
  exports: [PROFILE_REPOSITORY, ProfileOwnerGuard],
})
export class ProfileModule {}
