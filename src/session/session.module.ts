import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ProfileModule } from '../profile/profile.module';

import { SessionController } from './session.controller';
import { SessionService } from './session.service';

import { SESSION_REPOSITORY } from './domain/session.repo.interface';
import { SessionRepository } from './infrastructure/repository/session.repository';
import { SessionSchema } from './infrastructure/schema/session.schema';

import {
  DB_MODEL_REGISTRY,
  DbModelToken,
} from '../shared/mongoose/modelRegistry/mongoose.modelRegistry';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: DB_MODEL_REGISTRY.SESSION.MODEL_TOKEN as DbModelToken,
        schema: SessionSchema,
      },
    ]),
    // ProfileModule exports PROFILE_REPOSITORY, which SessionService injects
    // to look up profiles for USER sessions.
    ProfileModule,
  ],
  controllers: [SessionController],
  providers: [
    SessionService,
    { provide: SESSION_REPOSITORY, useClass: SessionRepository },
  ],
})
export class SessionModule {}
