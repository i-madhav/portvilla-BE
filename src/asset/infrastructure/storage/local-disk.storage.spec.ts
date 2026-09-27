import {
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';

import { LocalDiskStorage } from './local-disk.storage';

const KEY = 'q/user/01K4S0V2M9T7X3QF8G2ZQ7HB4N';
const BYTES = Buffer.from('exactly these bytes');

/**
 * The local upload URL must hold the same line R2's signature holds: one key,
 * one type, one size, one digest, for a bounded time.
 */
describe('LocalDiskStorage upload grants', () => {
  let root: string;
  let storage: LocalDiskStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'local-storage-spec-'));
    storage = new LocalDiskStorage(root, 'http://api.test');
  });

  afterEach(async () => {
    jest.useRealTimers();
    await rm(root, { recursive: true, force: true });
  });

  async function tokenFor(ttlSeconds = 300): Promise<string> {
    const { url } = await storage.createUploadUrl({
      key: KEY,
      contentType: 'image/png',
      byteSize: BYTES.length,
      sha256: createHash('sha256').update(BYTES).digest('hex'),
      ttlSeconds,
    });
    return url.split('/').pop() ?? '';
  }

  function upload(
    token: string,
    body: Buffer = BYTES,
    contentType = 'image/png',
    contentLength = String(BYTES.length),
  ): Promise<void> {
    return storage.receiveUpload(
      token,
      contentType,
      contentLength,
      Readable.from([body]),
    );
  }

  it('accepts exactly the granted upload', async () => {
    await upload(await tokenFor());
    expect(await storage.head('QUARANTINE', KEY)).toEqual({
      byteSize: BYTES.length,
    });
  });

  it('refuses a tampered token', async () => {
    const [payload, signature] = (await tokenFor()).split('.');
    const forged = Buffer.from(
      Buffer.from(payload, 'base64url')
        .toString()
        .replace('"byteSize":19', '"byteSize":99999'),
    ).toString('base64url');
    await expect(upload(`${forged}.${signature}`)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses a token from another process (different secret)', async () => {
    const other = new LocalDiskStorage(root, 'http://api.test');
    const { url } = await other.createUploadUrl({
      key: KEY,
      contentType: 'image/png',
      byteSize: BYTES.length,
      sha256: 'a'.repeat(64),
      ttlSeconds: 300,
    });
    await expect(upload(url.split('/').pop() ?? '')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses an expired token', async () => {
    const token = await tokenFor(1);
    jest.useFakeTimers({ now: Date.now() + 2000 });
    await expect(upload(token)).rejects.toThrow('Upload token has expired.');
  });

  it('refuses a different Content-Type', async () => {
    await expect(
      upload(await tokenFor(), BYTES, 'text/html'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a different Content-Length', async () => {
    await expect(
      upload(await tokenFor(), BYTES, 'image/png', '5'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('aborts a body longer than granted and leaves nothing behind', async () => {
    const longer = Buffer.concat([BYTES, Buffer.from('!')]);
    await expect(upload(await tokenFor(), longer)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    expect(await storage.head('QUARANTINE', KEY)).toBeNull();
  });

  it('refuses same-length bytes that do not match the digest', async () => {
    const swapped = Buffer.from('EXACTLY THESE BYTES');
    await expect(upload(await tokenFor(), swapped)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(await storage.head('QUARANTINE', KEY)).toBeNull();
  });

  it('refuses a key that escapes the storage root', async () => {
    await expect(
      storage.head('QUARANTINE', '../../etc/passwd'),
    ).rejects.toThrow(/escapes the storage root/);
  });
});
