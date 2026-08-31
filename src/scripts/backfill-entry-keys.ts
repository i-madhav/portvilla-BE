import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { NestFactory } from '@nestjs/core';
import { Model, Types } from 'mongoose';

import { ENV_FILE_PATHS } from '../shared/configuration/env-files.config';
import { MongooseDatabaseModule } from '../shared/mongoose/mongoose.module';
import {
  KEYED_ARRAY_SECTIONS,
  withUniqueKeys,
} from '../profile/domain/entry-key';
import type { KeyableEntry } from '../profile/domain/entry-key';
import type { ProfileDocument } from '../profile/domain/profile.interface';
import { PROFILE_MODEL } from '../profile/infrastructure/repository/profile.repository';
import { ProfileSchema } from '../profile/infrastructure/schema/profile.schema';

/**
 * One-shot backfill: gives every array-section entry in every stored profile a
 * stable `key`.
 *
 * Idempotent — an entry that already carries a well-formed, unique key keeps it,
 * and a profile with nothing to change is not written at all. Safe to run twice,
 * and safe to run against a database that is already fully keyed.
 *
 *   pnpm build && node dist/scripts/backfill-entry-keys.js
 *
 * Run it before anything starts addressing content by key, since an unkeyed
 * entry is invisible to the slide catalog.
 */

/** Just enough of the app to reach the profiles collection with real config. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ENV_FILE_PATHS }),
    MongooseDatabaseModule,
    MongooseModule.forFeature([{ name: PROFILE_MODEL, schema: ProfileSchema }]),
  ],
})
class BackfillModule {}

/** A profile as it comes back from `.lean()` — plain objects, unvalidated. */
type LeanProfile = Record<string, unknown> & {
  _id: Types.ObjectId;
  username: string;
};

async function backfill(): Promise<void> {
  const logger = new Logger('BackfillEntryKeys');

  const context = await NestFactory.createApplicationContext(BackfillModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const profiles = context.get<Model<ProfileDocument>>(
      getModelToken(PROFILE_MODEL),
    );

    let scanned = 0;
    let updated = 0;

    for await (const profile of profiles.find().lean<LeanProfile>().cursor()) {
      scanned += 1;

      const changes = keyedSectionsOf(profile);
      if (Object.keys(changes).length === 0) continue;

      // runValidators stays off: these documents predate the required `key`, and
      // this write is precisely what makes them valid.
      await profiles.updateOne({ _id: profile._id }, { $set: changes }).exec();
      updated += 1;
      logger.log(
        `keyed ${profile.username}: [${Object.keys(changes).join(', ')}]`,
      );
    }

    logger.log(`done — ${scanned} profile(s) scanned, ${updated} updated`);
  } finally {
    await context.close();
  }
}

/**
 * Returns a `$set` payload holding only the sections whose keys actually
 * changed. An already-keyed profile yields `{}`, which is what makes a second
 * run a no-op rather than a rewrite.
 */
function keyedSectionsOf(profile: LeanProfile): Record<string, unknown> {
  const changes: Record<string, unknown> = {};

  for (const section of KEYED_ARRAY_SECTIONS) {
    const entries = profile[section];
    if (!Array.isArray(entries)) continue;

    const keyed = withUniqueKeys(entries as KeyableEntry[]).map((entry) =>
      section === 'works'
        ? { ...entry, stages: withUniqueKeys(stagesOf(entry)) }
        : entry,
    );

    if (keysDiffer(entries as KeyableEntry[], keyed)) changes[section] = keyed;
  }

  return changes;
}

function stagesOf(work: KeyableEntry): KeyableEntry[] {
  const stages = (work as { stages?: unknown }).stages;
  return Array.isArray(stages) ? (stages as KeyableEntry[]) : [];
}

/** True when any entry — or any stage nested in one — gained or changed a key. */
function keysDiffer(before: KeyableEntry[], after: KeyableEntry[]): boolean {
  return after.some((entry, i) => {
    const original = before[i];
    if (original.key !== entry.key) return true;

    const originalStages = stagesOf(original);
    const currentStages = stagesOf(entry);
    return currentStages.some(
      (stage, j) => originalStages[j]?.key !== stage.key,
    );
  });
}

backfill().catch((error: unknown) => {
  new Logger('BackfillEntryKeys').error(error);
  process.exitCode = 1;
});
