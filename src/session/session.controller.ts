import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { SessionService } from './session.service';
import { CreateSessionDto, SessionResponseDto } from './domain/dto/createSession';
import { CreateSessionEndpoint } from './swagger/session.swagger';

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
}
