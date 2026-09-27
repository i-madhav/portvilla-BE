import { R2Storage } from './r2.storage';

/**
 * Presigning is pure computation, so the load-bearing property — that type,
 * size and digest are *signed headers* and not optional extras — can be
 * checked offline. Whether R2 then enforces them still needs one manual run
 * against the real service (decision doc §16).
 */
describe('R2Storage.createUploadUrl', () => {
  const storage = new R2Storage({
    accountId: 'account123',
    accessKeyId: 'AKIDEXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    buckets: { QUARANTINE: 'portvilla-quarantine', ASSET: 'portvilla-media' },
    publicBaseUrl: 'https://cdn.portvilla.com',
  });
  const sha256 =
    '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

  async function presign() {
    const upload = await storage.createUploadUrl({
      key: 'q/user/01K4S0V2M9T7X3QF8G2ZQ7HB4N',
      contentType: 'image/png',
      byteSize: 842104,
      sha256,
      ttlSeconds: 300,
    });
    return { upload, url: new URL(upload.url) };
  }

  it('targets the quarantine bucket at the given key', async () => {
    const { url } = await presign();
    expect(url.host).toBe('account123.r2.cloudflarestorage.com');
    expect(url.pathname).toBe(
      '/portvilla-quarantine/q/user/01K4S0V2M9T7X3QF8G2ZQ7HB4N',
    );
  });

  it('signs Content-Type, Content-Length and the SHA-256 checksum', async () => {
    const { url } = await presign();
    const signed = url.searchParams.get('X-Amz-SignedHeaders')?.split(';');
    expect(signed).toEqual(
      expect.arrayContaining([
        'content-length',
        'content-type',
        'host',
        'x-amz-checksum-sha256',
      ]),
    );
  });

  it('keeps the checksum a header, not a query parameter', async () => {
    const { url } = await presign();
    const params = [...url.searchParams.keys()].map((key) => key.toLowerCase());
    expect(params).not.toContain('x-amz-checksum-sha256');
    // No SDK-added CRC32 of an empty body riding alongside.
    expect(params.some((key) => key.startsWith('x-amz-checksum-'))).toBe(false);
    expect(params).not.toContain('x-amz-sdk-checksum-algorithm');
  });

  it('expires after the requested TTL', async () => {
    const { url } = await presign();
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
  });

  it('tells the client the exact headers to send, checksum in base64', async () => {
    const { upload } = await presign();
    expect(upload.requiredHeaders).toEqual({
      'Content-Type': 'image/png',
      'Content-Length': '842104',
      'x-amz-checksum-sha256': Buffer.from(sha256, 'hex').toString('base64'),
    });
  });

  it('delivers through the Worker, large variant', () => {
    expect(storage.deliveryUrl('01K4S0V2M9T7X3QF8G2ZQ7HB4N')).toBe(
      'https://cdn.portvilla.com/i/01K4S0V2M9T7X3QF8G2ZQ7HB4N/l',
    );
  });
});
