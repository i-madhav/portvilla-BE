import {
  BadRequestException,
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';

import { AssetService, UploadRequest } from './asset.service';
import { quarantineKeyFor } from './domain/asset-keys';
import {
  AssetUsage,
  CommitAssetData,
  CreateAssetData,
  IAssetRepository,
} from './domain/asset-repository.interface';
import {
  ASSET_LIMITS,
  AssetKind,
  AssetStatus,
  IAssetRecord,
} from './domain/asset.interface';
import { LocalDiskStorage } from './infrastructure/storage/local-disk.storage';
import {
  imageOfSize,
  jpegHeader,
  pngHeader,
} from './validation/test-images.fixture-spec';

const ALICE = '64a1b2c3d4e5f6789abcdef0';
const BOB = '64a1b2c3d4e5f6789abcdef1';

/** The repository contract, in memory — enough to exercise the service's state machine. */
class InMemoryAssetRepository implements IAssetRepository {
  readonly rows = new Map<string, IAssetRecord>();

  create(data: CreateAssetData): Promise<IAssetRecord> {
    const now = new Date();
    const record: IAssetRecord = {
      id: `row-${this.rows.size}`,
      assetId: data.assetId,
      kind: data.kind,
      status: AssetStatus.PENDING,
      resolvedUrl: null,
      declared: data.declared,
      actual: null,
      userId: data.userId,
      pendingExpiresAt: data.pendingExpiresAt,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(data.assetId, record);
    return Promise.resolve(record);
  }

  findAssetById(assetId: string): Promise<IAssetRecord | null> {
    return Promise.resolve(this.rows.get(assetId) ?? null);
  }

  markCommitted(
    assetId: string,
    data: CommitAssetData,
  ): Promise<IAssetRecord | null> {
    return this.transition(assetId, {
      status: AssetStatus.COMMITTED,
      actual: data.actual,
      resolvedUrl: data.resolvedUrl,
      pendingExpiresAt: null,
    });
  }

  markRejected(assetId: string, reason: string): Promise<IAssetRecord | null> {
    return this.transition(assetId, {
      status: AssetStatus.REJECTED,
      rejectionReason: reason,
      pendingExpiresAt: null,
    });
  }

  usageFor(userId: string, now: Date): Promise<AssetUsage> {
    const live = [...this.rows.values()].filter(
      (row) =>
        row.userId === userId &&
        (row.status === AssetStatus.COMMITTED ||
          (row.status === AssetStatus.PENDING &&
            row.pendingExpiresAt !== null &&
            row.pendingExpiresAt > now)),
    );
    return Promise.resolve({
      pendingCount: live.filter((row) => row.status === AssetStatus.PENDING)
        .length,
      totalCount: live.length,
      totalBytes: live.reduce(
        (sum, row) => sum + (row.actual?.byteSize ?? row.declared.byteSize),
        0,
      ),
    });
  }

  private transition(
    assetId: string,
    patch: Partial<IAssetRecord>,
  ): Promise<IAssetRecord | null> {
    const row = this.rows.get(assetId);
    if (!row || row.status !== AssetStatus.PENDING) {
      return Promise.resolve(null);
    }
    const next = { ...row, ...patch };
    this.rows.set(assetId, next);
    return Promise.resolve(next);
  }
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function request(bytes: Buffer, overrides: Partial<UploadRequest> = {}) {
  return {
    kind: AssetKind.PROFILE_IMAGE,
    filename: 'me.png',
    contentType: 'image/png',
    byteSize: bytes.length,
    sha256: sha256(bytes),
    ...overrides,
  };
}

describe('AssetService', () => {
  let root: string;
  let storage: LocalDiskStorage;
  let repo: InMemoryAssetRepository;
  let service: AssetService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'asset-spec-'));
    storage = new LocalDiskStorage(root, 'http://api.test');
    repo = new InMemoryAssetRepository();
    service = new AssetService(repo, storage);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  /** Plays the browser: PUT the bytes to the URL the intent returned. */
  async function put(url: string, bytes: Buffer, contentType = 'image/png') {
    const token = url.split('/').pop() ?? '';
    await storage.receiveUpload(
      token,
      contentType,
      String(bytes.length),
      Readable.from([bytes]),
    );
  }

  async function intentFor(bytes: Buffer, overrides?: Partial<UploadRequest>) {
    const [ticket] = await service.createUploads(ALICE, [
      request(bytes, overrides),
    ]);
    return ticket;
  }

  it('runs intent → PUT → commit end to end', async () => {
    const bytes = imageOfSize(pngHeader(1200, 800), 4096);
    const ticket = await intentFor(bytes);

    expect(ticket.requiredHeaders).toEqual({
      'Content-Type': 'image/png',
      'Content-Length': '4096',
    });
    await put(ticket.url, bytes);

    const asset = await service.commit(ALICE, ticket.assetId);
    expect(asset.status).toBe(AssetStatus.COMMITTED);
    expect(asset.actual).toEqual({
      contentType: 'image/png',
      byteSize: 4096,
      width: 1200,
      height: 800,
    });
    expect(asset.resolvedUrl).toBe(
      `http://api.test/api/v1/assets/local/objects/${ticket.assetId}`,
    );

    // Promoted with metadata from the sniffer, and the quarantine copy is gone.
    const object = await storage.readObject(ticket.assetId);
    expect(object?.meta.contentType).toBe('image/png');
    object?.body.destroy();
    expect(
      await storage.head('QUARANTINE', quarantineKeyFor(ALICE, ticket.assetId)),
    ).toBeNull();
  });

  it('is idempotent: committing twice returns the same asset', async () => {
    const bytes = imageOfSize(pngHeader(10, 10), 100);
    const ticket = await intentFor(bytes);
    await put(ticket.url, bytes);

    const first = await service.commit(ALICE, ticket.assetId);
    const second = await service.commit(ALICE, ticket.assetId);
    expect(second).toEqual(first);
  });

  it('answers 409 when committing before the bytes arrive', async () => {
    const ticket = await intentFor(imageOfSize(pngHeader(10, 10), 100));
    await expect(service.commit(ALICE, ticket.assetId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("answers 404 — not 403 — for another user's asset", async () => {
    const bytes = imageOfSize(pngHeader(10, 10), 100);
    const ticket = await intentFor(bytes);
    await put(ticket.url, bytes);

    await expect(service.commit(BOB, ticket.assetId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('answers 404 for a malformed asset id without querying', async () => {
    await expect(service.commit(ALICE, '../../etc')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('answers 410 once the commit window has closed', async () => {
    const ticket = await intentFor(imageOfSize(pngHeader(10, 10), 100));
    const row = repo.rows.get(ticket.assetId);
    if (row) row.pendingExpiresAt = new Date(Date.now() - 1000);

    await expect(service.commit(ALICE, ticket.assetId)).rejects.toBeInstanceOf(
      GoneException,
    );
  });

  it('rejects bytes that are not what was declared, and keeps rejecting', async () => {
    // A JPEG uploaded under a PNG declaration.
    const bytes = imageOfSize(jpegHeader(10, 10), 100);
    const ticket = await intentFor(bytes);
    await put(ticket.url, bytes);

    await expect(service.commit(ALICE, ticket.assetId)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(repo.rows.get(ticket.assetId)?.status).toBe(AssetStatus.REJECTED);
    expect(
      await storage.head('QUARANTINE', quarantineKeyFor(ALICE, ticket.assetId)),
    ).toBeNull();
    // A retry gets the same verdict, not a second inspection.
    await expect(service.commit(ALICE, ticket.assetId)).rejects.toThrow(
      'File content does not match the declared content type.',
    );
  });

  it('rejects when the stored size differs from the declared size', async () => {
    const bytes = imageOfSize(pngHeader(10, 10), 100);
    const ticket = await intentFor(bytes);
    // Bypass the upload checks to simulate storage holding something else.
    const path = join(
      root,
      'quarantine',
      quarantineKeyFor(ALICE, ticket.assetId),
    );
    await put(ticket.url, bytes);
    await writeFile(path, imageOfSize(pngHeader(10, 10), 90));

    await expect(service.commit(ALICE, ticket.assetId)).rejects.toThrow(
      'Stored size does not match the declared size.',
    );
  });

  describe('intent validation', () => {
    it('refuses a content type the kind does not allow (SVG)', async () => {
      const bytes = Buffer.from('<svg/>');
      await expect(
        service.createUploads(ALICE, [
          request(bytes, { contentType: 'image/svg+xml' }),
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a file over the kind size limit, creating nothing', async () => {
      const ok = request(Buffer.from('a'));
      const tooBig = { ...ok, byteSize: 5 * 1024 * 1024 + 1 };
      await expect(
        service.createUploads(ALICE, [ok, tooBig]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.rows.size).toBe(0);
    });

    it('answers 429 past the pending-uploads quota', async () => {
      const file = request(Buffer.from('a'));
      const batch = Array.from({ length: 10 }, () => file);
      await service.createUploads(ALICE, batch);
      await service.createUploads(ALICE, batch);

      const error = await service
        .createUploads(ALICE, batch)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect(repo.rows.size).toBe(20);
    });

    it('answers 429 past the byte quota', async () => {
      const big = {
        ...request(Buffer.from('a')),
        kind: AssetKind.FEATURE_IMAGE,
        byteSize: 25 * 1024 * 1024,
      };
      const batch = Array.from({ length: 10 }, () => big); // 250 MB
      await service.createUploads(ALICE, batch);
      await service.createUploads(ALICE, batch); // exactly at the 500 MB limit
      await expect(
        service.createUploads(ALICE, [request(Buffer.from('a'))]),
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('does not count expired intents against the quota', async () => {
      const file = request(Buffer.from('a'));
      const batch = Array.from(
        { length: ASSET_LIMITS.filesPerIntent },
        () => file,
      );
      await service.createUploads(ALICE, batch);
      await service.createUploads(ALICE, batch);
      for (const row of repo.rows.values()) {
        row.pendingExpiresAt = new Date(Date.now() - 1000);
      }
      await expect(service.createUploads(ALICE, batch)).resolves.toHaveLength(
        10,
      );
    });
  });

  it('answers 503 when no storage is configured', async () => {
    const unconfigured = new AssetService(repo, null);
    await expect(
      unconfigured.createUploads(ALICE, [request(Buffer.from('a'))]),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
