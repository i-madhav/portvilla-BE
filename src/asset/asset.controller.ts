import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt.interface';

import { AssetService } from './asset.service';
import { CreateUploadIntentDto } from './dto/create-upload-intent.dto';
import {
  AssetResponseDto,
  UploadIntentResponseDto,
  UploadTicketDto,
} from './dto/asset-response.dto';
import {
  CommitUploadEndpoint,
  CreateUploadIntentEndpoint,
} from './swagger/asset.swagger';

/**
 * Assets are owned by a *user*, not a profile, so an avatar can be uploaded
 * during onboarding before a profile exists. Ownership is enforced per asset
 * in the service on every access.
 */
@ApiTags('Assets')
@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  /** 20 / minute caps signing-request floods; each call signs at most 10 URLs. */
  @Post('uploads')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @CreateUploadIntentEndpoint()
  async createUploads(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateUploadIntentDto,
  ): Promise<UploadIntentResponseDto> {
    const tickets = await this.assetService.createUploads(user.sub, dto.files);
    return {
      uploads: tickets.map((ticket) => UploadTicketDto.fromTicket(ticket)),
    };
  }

  @Post('uploads/:assetId/commit')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @CommitUploadEndpoint()
  async commit(
    @CurrentUser() user: JwtPayload,
    @Param('assetId') assetId: string,
  ): Promise<AssetResponseDto> {
    const asset = await this.assetService.commit(user.sub, assetId);
    return AssetResponseDto.fromRecord(asset);
  }
}
