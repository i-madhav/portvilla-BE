import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
} from '@nestjs/swagger';

import { AgentContextResponseDto } from '../dto/agent-context-response.dto';

// ─── GET /agent/context/:username ─────────────────────────────────────────────

export const GetAgentContextEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity('service-token'),
    ApiOperation({
      summary: 'Portfolio context for the voice worker',
      description:
        'Machine-to-machine. Called once per room join by `portvilla-agent`, authenticated ' +
        'with the shared worker↔backend secret as `Authorization: Bearer <AGENT_SERVICE_TOKEN>` ' +
        '— **not** a user access token.\n\n' +
        'Returns the agent persona and the derived slide catalog: an ordered array where ' +
        'navigation is the index, so `next_slide()` is index + 1 and a work is immediately ' +
        'followed by its own stage slides. Slides are derived from the profile sections at ' +
        'read time; nothing here is authored.\n\n' +
        'Only `public` profiles resolve — `private` and `protected` both 404, indistinguishably ' +
        'from an unknown username. A protected profile has no agent, because the worker holds ' +
        'no proof that the visitor passed the password gate.\n\n' +
        'This response is a narrower allowlist than the public profile: it never carries ' +
        '`aiSettings` (including `apiKey`), the resume, or `social.email` / `social.phone`.',
    }),
    ApiParam({
      name: 'username',
      example: 'jane-doe',
      description: 'Profile username. Trimmed and lowercased before lookup.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Persona and slide catalog.',
      type: AgentContextResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Missing or invalid service token.',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description:
        'No such username, or the profile is `private` / `protected`. The two are ' +
        'deliberately indistinguishable.',
    }),
    ApiResponse({
      status: HttpStatus.TOO_MANY_REQUESTS,
      description: 'Rate limit exceeded (30 requests / minute).',
    }),
  );
