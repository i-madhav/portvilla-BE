import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IObjectStorage } from '../../domain/object-storage.interface';
import { LocalDiskStorage } from './local-disk.storage';
import { R2Storage } from './r2.storage';

const logger = new Logger('AssetStorage');

/** Environments where bytes on the instance's own disk are acceptable. */
const LOCAL_STORAGE_ENVS = new Set(['development', 'test']);

/**
 * Picks the storage backend at boot.
 *
 * - `R2_ACCOUNT_ID` set → R2, and every other R2 key is required (`getOrThrow`):
 *   a half-configured R2 fails the boot loudly instead of misbehaving later.
 * - Unset in development/test → local disk, so `pnpm start:dev` and the specs
 *   need no Cloudflare account.
 * - Unset anywhere else → `null`. The app still boots (the rest of the API is
 *   unaffected), and the asset endpoints answer 503. Falling back to local
 *   disk in production would rebuild the exact defect this module exists to
 *   remove: files lost on every deploy and invisible across instances.
 */
export function createObjectStorage(
  config: ConfigService,
): IObjectStorage | null {
  if (config.get<string>('R2_ACCOUNT_ID')) {
    return new R2Storage({
      accountId: config.getOrThrow<string>('R2_ACCOUNT_ID'),
      accessKeyId: config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
      secretAccessKey: config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      buckets: {
        QUARANTINE: config.getOrThrow<string>('R2_BUCKET_QUARANTINE'),
        ASSET: config.getOrThrow<string>('R2_BUCKET_MEDIA'),
      },
      publicBaseUrl: stripTrailingSlash(
        config.getOrThrow<string>('R2_PUBLIC_BASE_URL'),
      ),
    });
  }

  const env = config.get<string>('NODE_ENV') ?? '';
  if (!LOCAL_STORAGE_ENVS.has(env)) {
    logger.error(
      `R2 is not configured and NODE_ENV=${env || '(unset)'} does not allow local storage — asset uploads are disabled.`,
    );
    return null;
  }

  const port = config.get<string>('PORT') ?? '3000';
  logger.warn(
    'R2_ACCOUNT_ID is not set — using local disk storage under .local-storage/. Development only.',
  );
  return new LocalDiskStorage('.local-storage', `http://localhost:${port}`);
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
