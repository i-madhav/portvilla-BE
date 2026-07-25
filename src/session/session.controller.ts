import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ProfileOwnerGuard,
  type ProfileRequest,
} from '../profile/guards/profile-owner.guard';

import { SessionService } from './session.service';
import {
  CreateSessionDto,
  SessionResponseDto,
} from './domain/dto/createSession';
import type { SessionActivityDto } from './domain/dto/sessionActivity';
import {
  CreateSessionEndpoint,
  SessionWebhookEndpoint,
  SessionActivityEndpoint,
} from './swagger/session.swagger';

@ApiTags('Session')
@Controller('session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CreateSessionEndpoint()
  createSession(@Body() dto: CreateSessionDto): Promise<SessionResponseDto> {
    return this.sessionService.createSession(dto);
  }

  /**
   * LiveKit lifecycle webhook. Public — authenticity comes from the signed body,
   * verified in the service, not from a bearer token. Reads the raw body so the
   * signature matches the exact bytes LiveKit signed.
   */
  // LiveKit can legitimately burst lifecycle events; authenticity is enforced by
  // signature verification, so the generic IP rate limit does not apply here.
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @SessionWebhookEndpoint()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('authorization') authHeader?: string,
  ): Promise<{ received: true }> {
    const raw = req.rawBody?.toString('utf8') ?? '';
    await this.sessionService.handleWebhook(raw, authHeader);
    return { received: true };
  }

  @Get('activity')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, ProfileOwnerGuard)
  @SessionActivityEndpoint()
  getActivity(@Req() req: ProfileRequest): Promise<SessionActivityDto> {
    return this.sessionService.getActivity(req.profile.id);
  }
}
