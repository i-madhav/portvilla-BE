import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AgentService } from './agent.service';
import { AgentContextResponseDto } from './dto/agent-context-response.dto';
import { ServiceTokenGuard } from './guards/service-token.guard';
import { GetAgentContextEndpoint } from './swagger/agent.swagger';

@ApiTags('Agent')
@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  /**
   * Machine-to-machine: the LiveKit worker fetches this once per room join.
   *
   * The limit is generous against that access pattern but finite, so a
   * misbehaving worker (or a leaked token) cannot turn the endpoint into a
   * profile-enumeration loop.
   */
  @Get('context/:username')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ServiceTokenGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @GetAgentContextEndpoint()
  getContext(
    @Param('username') username: string,
  ): Promise<AgentContextResponseDto> {
    return this.agentService.getContext(username);
  }
}
