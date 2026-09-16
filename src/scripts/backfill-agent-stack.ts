import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { NestFactory } from '@nestjs/core';
import { Model, Types } from 'mongoose';

import { ENV_FILE_PATHS } from '../shared/configuration/env-files.config';
import { MongooseDatabaseModule } from '../shared/mongoose/mongoose.module';
import {
  AgentSpeakingSpeed,
  type ProfileDocument,
} from '../profile/domain/profile.interface';
import { defaultAgentStack } from '../profile/domain/agent-stack/catalog';
import { PROFILE_MODEL } from '../profile/infrastructure/repository/profile.repository';
import { ProfileSchema } from '../profile/infrastructure/schema/profile.schema';

/**
 * One-shot: moves `agentPersona.speakingSpeed` into `agentStack.tts.speed` and
 * drops the two persona fields that no longer exist (`speakingSpeed`, `voiceId`).
 *
 * `voiceId` is dropped, not carried: it never had a dashboard field, so no
 * stored value was ever chosen by an owner. A profile with no `agentStack` gets
 * the catalog default with the carried speed. Idempotent — a profile without the
 * old fields is left untouched.
 *
 *   pnpm build && pnpm backfill:agent-stack
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ENV_FILE_PATHS }),
    MongooseDatabaseModule,
    MongooseModule.forFeature([{ name: PROFILE_MODEL, schema: ProfileSchema }]),
  ],
})
class BackfillModule {}

type LeanProfile = {
  _id: Types.ObjectId;
  username: string;
  agentPersona?: { speakingSpeed?: string; voiceId?: string | null };
  agentStack?: { tts?: { speed?: string } };
};

const SPEEDS = new Set<string>(Object.values(AgentSpeakingSpeed));

async function backfill(): Promise<void> {
  const logger = new Logger('BackfillAgentStack');
  const context = await NestFactory.createApplicationContext(BackfillModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const profiles = context.get<Model<ProfileDocument>>(
      getModelToken(PROFILE_MODEL),
    );
    const cursor = profiles
      .find({
        $or: [
          { 'agentPersona.speakingSpeed': { $exists: true } },
          { 'agentPersona.voiceId': { $exists: true } },
        ],
      })
      .lean<LeanProfile>()
      .cursor();

    let migrated = 0;
    for await (const profile of cursor) {
      const carried = profile.agentPersona?.speakingSpeed;
      const speed = carried && SPEEDS.has(carried) ? carried : undefined;

      const $set: Record<string, unknown> = {};
      if (!profile.agentStack) {
        const stack = defaultAgentStack();
        if (speed) stack.tts.speed = speed as AgentSpeakingSpeed;
        $set['agentStack'] = stack;
      } else if (speed) {
        $set['agentStack.tts.speed'] = speed;
      }

      await profiles.updateOne(
        { _id: profile._id },
        {
          ...(Object.keys($set).length ? { $set } : {}),
          $unset: {
            'agentPersona.speakingSpeed': '',
            'agentPersona.voiceId': '',
          },
        },
      );
      migrated += 1;
      logger.log(`migrated ${profile.username} (speed=${speed ?? 'default'})`);
    }
    logger.log(`done — ${migrated} profile(s) migrated`);
  } finally {
    await context.close();
  }
}

backfill().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
