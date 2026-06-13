import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { CreateSessionDto, SessionResponseDto } from '../domain/dto/createSession';

// ─── POST /session ────────────────────────────────────────────────────────────

export const CreateSessionEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a LiveKit voice session',
      description:
        'Provisions a unique LiveKit room, mints a participant access token with the correct ' +
        'agent dispatch baked into `RoomConfiguration`, persists the session record, and ' +
        'returns everything the frontend needs to call `session.start()`.\n\n' +
        '**GUEST** — generates a random room name and identity; dispatches `welcome-agent`.\n\n' +
        '**USER** — looks up the profile by `profileUsername`; dispatches `portfolio-agent` ' +
        'with `{ profile_id, profile_username }` in the LiveKit job metadata so the agent can ' +
        'fetch portfolio context on startup.',
    }),
    ApiBody({ type: CreateSessionDto }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Session created. Hand `participantToken` and `livekitUrl` to the LiveKit SDK.',
      type: SessionResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Validation error — e.g. `profileUsername` is missing or malformed for a USER session.',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'No profile found for the given `profileUsername`.',
    }),
    ApiResponse({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'LiveKit token generation failed — check LIVEKIT_API_KEY / LIVEKIT_API_SECRET.',
    }),
  );
