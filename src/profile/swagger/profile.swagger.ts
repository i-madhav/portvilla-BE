import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProfileResponseDto } from '../dto/profile-response.dto';

// ─── Endpoint decorators ─────────────────────────────────────────────────────
// All Swagger documentation for the profile module lives here.
// Import these composed decorators into the controller — never annotate
// controller methods with @ApiOperation / @ApiResponse directly.

/**
 * GET /profile/me
 * Returns the authenticated user's public profile.
 */
export const GetMeEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get current user profile',
      description:
        'Returns the public profile of the currently authenticated user. ' +
        'Requires a valid Bearer access token in the `Authorization` header. ' +
        'Sensitive fields (`passwordHash`, `refreshTokenHash`) are never included in the response.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Profile retrieved successfully.',
      type: ProfileResponseDto,
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
