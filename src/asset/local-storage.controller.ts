import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { ASSET_ID_PATTERN } from './domain/asset.interface';
import {
  OBJECT_STORAGE,
  type IObjectStorage,
} from './domain/object-storage.interface';
import { LocalDiskStorage } from './infrastructure/storage/local-disk.storage';
import { LocalStorageEndpoint } from './swagger/asset.swagger';

/**
 * Plays the parts R2 and the delivery Worker play in production, so the full
 * intent → PUT → commit → view loop runs offline. Every route 404s unless the
 * bound storage is `LocalDiskStorage`, which the factory only allows in
 * development/test.
 *
 * Unauthenticated on purpose, like the R2 endpoint it mimics: the upload token
 * *is* the credential, and delivered images are public-class.
 */
@Controller('assets/local')
export class LocalStorageController {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: IObjectStorage | null,
  ) {}

  @Put('uploads/:token')
  @HttpCode(HttpStatus.OK)
  @LocalStorageEndpoint()
  async upload(
    @Param('token') token: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.local().receiveUpload(
      token,
      req.headers['content-type'],
      req.headers['content-length'],
      req,
    );
  }

  @Get('objects/:assetId')
  @LocalStorageEndpoint()
  async object(
    @Param('assetId') assetId: string,
    @Res() res: Response,
  ): Promise<void> {
    const object = ASSET_ID_PATTERN.test(assetId)
      ? await this.local().readObject(assetId)
      : null;
    if (!object) throw new NotFoundException();

    // The same response hardening the Worker applies: even a polyglot that got
    // past validation cannot execute or be re-sniffed as something else.
    res.set({
      'Content-Type': object.meta.contentType,
      'Cache-Control': object.meta.cacheControl,
      'Content-Disposition': object.meta.contentDisposition,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    object.body.pipe(res);
  }

  private local(): LocalDiskStorage {
    if (!(this.storage instanceof LocalDiskStorage)) {
      throw new NotFoundException();
    }
    return this.storage;
  }
}
