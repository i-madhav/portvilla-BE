import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { UserResponseDto } from '../dto/user-response.dto';

const Bearer = (): MethodDecorator => applyDecorators(ApiBearerAuth());

// ─── GET /users/me ────────────────────────────────────────────────────────────

export const GetMeEndpoint = (): MethodDecorator =>
  applyDecorators(
    Bearer(),
    ApiOperation({
      summary: 'Get current user account',
      description:
        'Returns the account record of the currently authenticated user. ' +
        'Sensitive fields (passwordHash, refreshTokenHash) are never included.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'User account retrieved successfully.',
      type: UserResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Access token is missing, invalid, or expired.',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'The user associated with this token no longer exists.',
    }),
  );