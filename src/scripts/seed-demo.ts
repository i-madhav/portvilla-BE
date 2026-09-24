import { Logger, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { readFileSync } from 'node:fs';
import * as bcrypt from 'bcrypt';

import { ENV_FILE_PATHS } from '../shared/configuration/env-files.config';
import { MongooseDatabaseModule } from '../shared/mongoose/mongoose.module';
import { AuthModule } from '../auth/auth.module';
import { USER_REPOSITORY } from '../auth/domain/user-repository.interface';
import type { IUserRepository } from '../auth/domain/user-repository.interface';
import type { IUserRecord } from '../auth/interfaces/user.interface';
import { ProfileModule } from '../profile/profile.module';
import { ProfileService } from '../profile/profile.service';
import { PROFILE_REPOSITORY } from '../profile/domain/profile-repository.interface';
import type { IProfileRepository } from '../profile/domain/profile-repository.interface';
import {
  EntityType,
  ProfileVisibility,
} from '../profile/domain/profile.interface';
import type { IProfileRecord } from '../profile/domain/profile.interface';
import { projectSlides } from '../profile/domain/slide.projector';
import type { Slide } from '../profile/domain/slide';
import { MAX_BRIEF_LENGTH } from '../profile/domain/section-limits';
import { CreateProfileDto } from '../profile/dto/create-profile.dto';
import { UpdateProfileDto } from '../profile/dto/update-profile.dto';
import { IdentityDto } from '../profile/dto/sections/identity.dto';
import { MIN_DESCRIPTION_LENGTH } from '../profile/dto/generate-profile.dto';
import {
  GenerationFailedError,
  GenerationService,
} from '../profile/generation/generation.service';
import { applyDraft } from '../profile/generation/assemble';
import { GENERATED_SECTIONS } from '../profile/generation/generation.types';
import type { GenerationResult } from '../profile/generation/generation.types';
import {
  defaultAgentPersona,
  defaultAgentStack,
  toAiSettings,
  toIdentitySection,
  toSocialSection,
} from '../profile/mappers/profile-section.mapper';

import { PORTVILLA_BRIEF } from './fixtures/portvilla-brief';

/**
 * The demo profile: Portvilla describing itself.
 *
 *   pnpm build && pnpm seed:demo                 # dry run — reads, writes nothing
 *   pnpm build && pnpm seed:demo --apply         # writes the profile
 *   pnpm build && pnpm seed:demo --brief ./x.txt # another description
 *   pnpm build && pnpm seed:demo --entity company # what a company would get
 *
 * It runs the **same `GenerationService` the endpoint runs** and accepts the
 * draft through the **same `PATCH` path the owner would** — the pipe, the DTO,
 * the mappers, the repository. A seed that wrote sections straight into Mongo
 * would prove nothing about the feature and would be the second write path the
 * whole design exists to avoid.
 *
 * A dry run is strictly read-only: no account, no profile, no draft. That is
 * stricter than `plan.md` §11 reads, on purpose — a "dry run" that leaves an
 * account behind surprises someone exactly once, badly.
 *
 * Idempotent under `--apply`: array sections are written whole, so a re-run
 * replaces the generated content rather than appending to it.
 */

// ─── What the demo is ─────────────────────────────────────────────────────────

const DEMO_USERNAME = 'portvilla';

/**
 * Name and entity type are the **owner's** input, never the generator's (plan
 * §2), so they are fixed here and the description fills everything else.
 */
const DEMO_IDENTITY: IdentityDto = {
  entityType: EntityType.PRODUCT,
  name: 'Portvilla',
};

/** Same work factor the auth flow uses for a real password. */
const BCRYPT_ROUNDS = 10;

// ─── Wiring ───────────────────────────────────────────────────────────────────

/**
 * The app's own modules, not a hand-built subset: `ProfileModule` brings the
 * service, the repository and `GenerationService` already wired to `LlmModule`,
 * so what runs here is what runs behind the endpoint.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ENV_FILE_PATHS }),
    MongooseDatabaseModule,
    AuthModule,
    ProfileModule,
  ],
})
class SeedModule {}

// ─── Options ──────────────────────────────────────────────────────────────────

interface Options {
  apply: boolean;
  briefPath: string | null;
  /** Dry-run only — see `--entity` in `parseArgs`. */
  entityType: EntityType | null;
}

/** A failure the operator caused and can fix — printed as a sentence, not a stack. */
class SeedError extends Error {}

function parseArgs(argv: string[]): Options {
  const options: Options = { apply: false, briefPath: null, entityType: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--brief') {
      const path = argv[i + 1];
      if (!path || path.startsWith('--')) {
        throw new SeedError('--brief needs a path: --brief ./description.txt');
      }
      options.briefPath = path;
      i += 1;
    } else if (arg === '--entity') {
      // The generators' vocabulary comes from the profile's entity type, not
      // from the description — a company's works are "case studies", a
      // product's are "stories". So swapping the description alone cannot show
      // what another entity type would get, and this flag completes `--brief`.
      //
      // Dry run only: the stored profile's entity type is the owner's answer to
      // "what is this profile for", and a seed script does not get to change it.
      const value = argv[i + 1];
      if (!isEntityType(value)) {
        throw new SeedError(
          `--entity needs one of: ${Object.values(EntityType).join(', ')}`,
        );
      }
      options.entityType = value;
      i += 1;
    } else {
      throw new SeedError(
        `Unknown argument "${arg}". Usage: seed:demo [--apply] [--brief <path>] [--entity <type>]`,
      );
    }
  }

  if (options.apply && options.entityType) {
    throw new SeedError(
      '--entity describes a hypothetical profile, so it only works on a dry run. Drop --apply or drop --entity.',
    );
  }

  return options;
}

function isEntityType(value: string | undefined): value is EntityType {
  return Object.values(EntityType).includes(value as EntityType);
}

function readDescription(path: string | null): string {
  const description = (path ? readBrief(path) : PORTVILLA_BRIEF).trim();

  // The same bounds `POST /profiles/me/generate` enforces. Checked here so a
  // too-short description fails before a model call, not after one.
  if (description.length < MIN_DESCRIPTION_LENGTH) {
    throw new SeedError(
      `The description is ${description.length} characters; at least ${MIN_DESCRIPTION_LENGTH} are needed.`,
    );
  }
  if (description.length > MAX_BRIEF_LENGTH) {
    throw new SeedError(
      `The description is ${description.length} characters; at most ${MAX_BRIEF_LENGTH} are allowed.`,
    );
  }
  return description;
}

function readBrief(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new SeedError(`Could not read a description from ${path}.`);
  }
}

/**
 * Production is not a place a demo profile belongs, and this script writes with
 * an owner's authority. Checked twice — before the database connection opens on
 * the process env, and again through `ConfigService`, which also sees the
 * mounted secret file that the process env does not.
 */
function assertNotProduction(nodeEnv: string | undefined): void {
  if (nodeEnv === 'production') {
    throw new SeedError(
      'Refusing to run with NODE_ENV=production. The demo profile is for local and staging databases.',
    );
  }
}

// ─── Output ───────────────────────────────────────────────────────────────────

function out(line = ''): void {
  process.stdout.write(`${line}\n`);
}

/** Two columns, so the header and the section table line up with each other. */
function row(label: string, value: string): void {
  out(`  ${label.padEnd(14)}${value}`);
}

function heading(text: string): void {
  out();
  out(text);
}

function printSections(result: GenerationResult): void {
  heading('Sections');
  for (const section of GENERATED_SECTIONS) {
    const status = result.sections[section];
    row(section, `${status.padEnd(11)}${countOf(result, section)}`);
  }
}

/** How much of each section survived assembly — the number the owner cares about. */
function countOf(
  result: GenerationResult,
  section: (typeof GENERATED_SECTIONS)[number],
): string {
  const value = result.draft[section];
  if (value === undefined) return '—';
  if (!Array.isArray(value)) return '1 entry';
  return value.length === 1 ? '1 entry' : `${value.length} entries`;
}

function printWarnings(result: GenerationResult): void {
  heading(
    result.warnings.length
      ? `Warnings (${result.warnings.length}) — entries generation refused to keep`
      : 'Warnings — none',
  );
  for (const warning of result.warnings) {
    row(warning.section, `${warning.code.padEnd(18)}${warning.message}`);
  }
}

function printCatalog(title: string, slides: Slide[]): void {
  heading(`${title} — ${slides.length} slide(s)`);
  slides.forEach((slide, index) => {
    const position = String(index + 1).padStart(3);
    out(
      `  ${position}  ${slide.id.padEnd(30)}${slide.template.padEnd(14)}${slide.title}`,
    );
  });
}

function printUsage(result: GenerationResult): void {
  const { calls, inputTokens, outputTokens, durationMs } = result.usage;
  heading(
    `Usage — ${calls} call(s) · ${inputTokens} in · ${outputTokens} out · ${(durationMs / 1000).toFixed(1)} s`,
  );
}

// ─── Upserts ──────────────────────────────────────────────────────────────────

/**
 * The demo owner. Verified on the way in — an unverified user cannot log in,
 * and the whole point of the demo profile is being able to sign in and look at
 * it in the dashboard.
 *
 * An existing user keeps their stored password: `IUserRepository` has no way to
 * change one, and a seed script is not the place to grow that authority.
 */
async function upsertUser(
  users: IUserRepository,
  email: string,
  password: string | undefined,
): Promise<IUserRecord> {
  const existing = await users.findByEmail(email);

  if (existing) {
    if (!existing.isEmailVerified) {
      await users.markEmailVerified(existing.id);
      row('user', `${email} — verified`);
    } else {
      row('user', `${email} — already there`);
    }
    return existing;
  }

  if (!password) {
    throw new SeedError(
      `No account for ${email} yet, so DEMO_USER_PASSWORD is needed to create one.`,
    );
  }

  const created = await users.create({
    email,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
  });
  await users.markEmailVerified(created.id);
  row('user', `${email} — created and verified`);
  return { ...created, isEmailVerified: true };
}

/** The demo profile, created on first run and reused afterwards. */
async function upsertProfile(
  profiles: IProfileRepository,
  profileService: ProfileService,
  userId: string,
): Promise<IProfileRecord> {
  const existing = await profiles.findByUserId(userId);
  if (existing) {
    if (existing.username !== DEMO_USERNAME) {
      throw new SeedError(
        `The demo account already owns "${existing.username}", not "${DEMO_USERNAME}". ` +
          'Point DEMO_USER_EMAIL at another account or remove that profile.',
      );
    }
    row('profile', `${DEMO_USERNAME} — already there`);
    return existing;
  }

  const claimed = await profiles.findByUsername(DEMO_USERNAME);
  if (claimed) {
    throw new SeedError(
      `The username "${DEMO_USERNAME}" belongs to another account. Remove that profile first.`,
    );
  }

  const dto: CreateProfileDto = {
    username: DEMO_USERNAME,
    visibility: ProfileVisibility.PUBLIC,
    identity: DEMO_IDENTITY,
  };
  await profileService.createProfile(userId, dto);

  const created = await profiles.findByUserId(userId);
  if (!created) {
    throw new SeedError('The profile was created but could not be read back.');
  }
  row('profile', `${DEMO_USERNAME} — created (product, public)`);
  return created;
}

/**
 * The profile a dry run generates against when none exists: exactly what
 * `createProfile` would have stored, minus the storing. Built from the same
 * mappers, so the defaults cannot drift from the real ones.
 */
function standInProfile(entityType: EntityType): IProfileRecord {
  const now = new Date();
  return {
    id: 'dry-run',
    userId: 'dry-run',
    username: DEMO_USERNAME,
    visibility: ProfileVisibility.PUBLIC,
    identity: toIdentitySection({ ...DEMO_IDENTITY, entityType }),
    works: [],
    timeline: [],
    capabilities: [],
    offerings: [],
    metrics: [],
    testimonials: [],
    team: [],
    media: [],
    content: [],
    social: toSocialSection(),
    brief: { text: null },
    aiSettings: toAiSettings(),
    agentPersona: defaultAgentPersona(),
    agentStack: defaultAgentStack(),
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Accepting the draft ──────────────────────────────────────────────────────

/**
 * Accept, exactly as the frontend will: the draft plus the description, through
 * the **same validation pipe `main.ts` installs** and then `updateProfile`.
 *
 * The pipe's options are repeated here rather than imported because `main.ts`
 * builds it inline; if they ever diverge, this script is the place that notices
 * — it runs real model output through them on every seed.
 */
async function acceptDraft(
  profileService: ProfileService,
  record: IProfileRecord,
  result: GenerationResult,
  description: string,
): Promise<void> {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  const payload = {
    ...result.draft,
    brief: { text: description },
    visibility: { visibility: ProfileVisibility.PUBLIC },
  };

  const dto = (await pipe.transform(payload, {
    type: 'body',
    metatype: UpdateProfileDto,
    data: undefined,
  })) as UpdateProfileDto;

  await profileService.updateProfile(record, dto);
}

// ─── The run ──────────────────────────────────────────────────────────────────

async function seedDemo(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  assertNotProduction(process.env.NODE_ENV);
  const description = readDescription(options.briefPath);

  const context = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const config = context.get(ConfigService);
    assertNotProduction(config.get<string>('NODE_ENV'));

    const users = context.get<IUserRepository>(USER_REPOSITORY);
    const profiles = context.get<IProfileRepository>(PROFILE_REPOSITORY);
    const profileService = context.get(ProfileService);
    const generation = context.get(GenerationService);

    const email = config.get<string>('DEMO_USER_EMAIL');
    if (!email) {
      throw new SeedError(
        'DEMO_USER_EMAIL is not set. Add it (and DEMO_USER_PASSWORD) to .env — see .env.example.',
      );
    }

    out();
    out(
      options.apply
        ? 'Portvilla demo seed — applying'
        : 'Portvilla demo seed — dry run, nothing will be written',
    );
    out();
    row(
      'brief',
      `${options.briefPath ?? 'Appendix A fixture'} · ${description.length} chars`,
    );
    row(
      'model',
      `${config.get<string>('PLATFORM_LLM_PROVIDER') ?? 'openai'} · ${
        config.get<string>('PLATFORM_LLM_MODEL') ?? 'provider default'
      }`,
    );

    const record = options.apply
      ? await applyTarget(users, profiles, profileService, email, config)
      : await dryRunTarget(users, profiles, email, options.entityType);

    heading('Generating — one brief call, then one per section …');
    const result = await generation.generate(record, description);

    printSections(result);
    printWarnings(result);
    printCatalog(
      options.apply ? 'Catalog to be written' : 'Catalog this would produce',
      projectSlides(applyDraft(record, result.draft)),
    );
    printUsage(result);

    if (!options.apply) {
      heading('Dry run — nothing was written. Re-run with --apply to keep it.');
      out();
      return;
    }

    await acceptDraft(profileService, record, result, description);

    const saved = await profiles.findByUsername(DEMO_USERNAME);
    if (!saved) {
      throw new SeedError(
        'The profile was written but could not be read back.',
      );
    }
    printCatalog('Catalog as stored', projectSlides(saved));

    heading(
      `Written. GET /profiles/me/preview and GET /agent/context/${DEMO_USERNAME} now serve this deck.`,
    );
    out();
  } finally {
    await context.close();
  }
}

/** The stored profile to write to, creating the account and the profile if needed. */
async function applyTarget(
  users: IUserRepository,
  profiles: IProfileRepository,
  profileService: ProfileService,
  email: string,
  config: ConfigService,
): Promise<IProfileRecord> {
  const user = await upsertUser(
    users,
    email,
    config.get<string>('DEMO_USER_PASSWORD'),
  );
  return upsertProfile(profiles, profileService, user.id);
}

/**
 * Read-only resolution of what a dry run generates against: the stored profile
 * when there is one, so the output reflects reality, and a stand-in when there
 * is not, so the first run can be a dry run.
 */
async function dryRunTarget(
  users: IUserRepository,
  profiles: IProfileRepository,
  email: string,
  entityType: EntityType | null,
): Promise<IProfileRecord> {
  if (entityType) {
    row('profile', `a hypothetical ${entityType}, nothing stored is read`);
    return standInProfile(entityType);
  }

  const user = await users.findByEmail(email);
  const record = user ? await profiles.findByUserId(user.id) : null;

  if (record) {
    row('profile', `${record.username} — the stored one`);
    return record;
  }

  row('profile', `${DEMO_USERNAME} — not created yet, using a fresh one`);
  return standInProfile(DEMO_IDENTITY.entityType);
}

seedDemo().catch((error: unknown) => {
  const logger = new Logger('SeedDemo');

  if (error instanceof SeedError) {
    logger.error(error.message);
  } else if (error instanceof GenerationFailedError) {
    logger.error(`Generation failed — ${error.message}`);
    logger.error(
      'A model key is needed: set PLATFORM_LLM_API_KEY (and _PROVIDER / _MODEL). See .env.example.',
    );
  } else {
    logger.error(error);
  }

  process.exitCode = 1;
});
