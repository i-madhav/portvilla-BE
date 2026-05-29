import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../interfaces/jwt.interface';

/**
 * Extracts the JWT payload attached by JwtAuthGuard from the request object.
 *
 * Usage: `@CurrentUser() user: JwtPayload`
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    return request.user;
  },
);
