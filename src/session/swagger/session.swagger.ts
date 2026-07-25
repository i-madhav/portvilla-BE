import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import {
  CreateSessionDto,
  SessionResponseDto,
} from '../domain/dto/createSession';
import { SessionActivityDto } from '../domain/dto/sessionActivity';

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
      description:
        'Session created. Hand `participantToken` and `livekitUrl` to the LiveKit SDK.',
      type: SessionResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description:
        'Validation error — e.g. `profileUsername` is missing or malformed for a USER session.',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'No profile found for the given `profileUsername`.',
    }),
    ApiResponse({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description:
        'LiveKit token generation failed — check LIVEKIT_API_KEY / LIVEKIT_API_SECRET.',
    }),
  );

// ─── POST /session/webhook ────────────────────────────────────────────────────

export const SessionWebhookEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiOperation({
      summary: 'LiveKit lifecycle webhook',
      description:
        'Public endpoint called by LiveKit. Authenticity is verified from the signed request ' +
        'body, not a bearer token. `participant_joined` (the minted visitor) transitions a ' +
        'session PENDING → ACTIVE; `room_finished` transitions it to ENDED and records endedAt. ' +
        'Unknown events and rooms are acknowledged with 200 so LiveKit does not retry.',
    }),
    ApiResponse({ status: HttpStatus.OK, description: 'Event acknowledged.' }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Webhook signature verification failed.',
    }),
  );

// ─── GET /session/activity ────────────────────────────────────────────────────

export const SessionActivityEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Agent conversation activity',
      description:
        "The authenticated owner's agent-conversation activity. Counts only sessions that " +
        'reached ACTIVE/ENDED — never PENDING mints — so figures reflect real conversations. ' +
        'Activity is measured from the webhook deploy date onward; older sessions stay PENDING ' +
        'and are excluded.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Activity summary.',
      type: SessionActivityDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Missing or invalid access token.',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'No profile for this account.',
    }),
  );
