import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { JWT_STRATEGY } from '../strategies/jwt.strategy';

/** Apply to any route that requires a valid Bearer access token. */
@Injectable()
export class JwtAuthGuard extends AuthGuard(JWT_STRATEGY) {
  private readonly logger = new Logger(JwtAuthGuard.name);

  /**
   * Passport calls this with the result of the strategy. We hook in only to log
   * *why* a request was rejected (missing / expired / malformed token) — the
   * default behaviour (throw on error / missing user) is otherwise preserved by
   * delegating to `super`.
   */
  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser | false,
    info: unknown,
    context: ExecutionContext,
    status?: number,
  ): TUser {
    if (err || !user) {
      const req = context.switchToHttp().getRequest<Request>();
      const reason = (info as Error | undefined)?.message ?? err?.message ?? 'no user';
      this.logger.warn(`Rejected ${req.method} ${req.originalUrl}: ${reason}`);
    }
    return super.handleRequest(err, user, info, context, status);
  }
}
