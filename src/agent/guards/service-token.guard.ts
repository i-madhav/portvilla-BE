import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/**
 * The shared secret between the LiveKit worker and this backend.
 *
 * Read with `getOrThrow` on construction, so a deployment missing it fails at
 * boot with a clear message rather than serving the agent context to anyone who
 * asks. This endpoint is strictly more revealing than the public profile — it
 * carries the `detail` bodies a visitor only hears on request — so the failure
 * mode has to be "does not start", never "starts unguarded".
 */
export const AGENT_SERVICE_TOKEN_ENV = 'AGENT_SERVICE_TOKEN';

/** Short enough not to be a nuisance, long enough not to be guessable. */
const MIN_TOKEN_LENGTH = 24;

/**
 * Authenticates a machine, not a person: `Authorization: Bearer <token>` where
 * the token is the worker↔backend shared secret.
 *
 * Deliberately not a JWT. There is one caller, no claims to carry and no
 * expiry to rotate through; a symmetric secret compared in constant time is the
 * whole requirement, and anything more would be machinery without a user.
 */
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  private readonly logger = new Logger(ServiceTokenGuard.name);

  /**
   * The expected token, pre-hashed.
   *
   * Comparing digests rather than the raw strings keeps the comparison at a
   * fixed 32 bytes, so `timingSafeEqual` can be used unconditionally and the
   * length of the real token is not observable from a length-mismatch path.
   */
  private readonly expectedDigest: Buffer;

  constructor(configService: ConfigService) {
    const token = configService.getOrThrow<string>(AGENT_SERVICE_TOKEN_ENV);

    if (token.length < MIN_TOKEN_LENGTH) {
      throw new Error(
        `${AGENT_SERVICE_TOKEN_ENV} must be at least ${MIN_TOKEN_LENGTH} characters. ` +
          'Generate one with: openssl rand -hex 32',
      );
    }
    this.expectedDigest = sha256(token);
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const presented = bearerToken(req.headers.authorization);

    if (presented === null || !this.matches(presented)) {
      // Log that it failed and from where — never the token that was presented.
      this.logger.warn(
        `Rejected ${req.method} ${req.originalUrl}: ${presented === null ? 'no bearer token' : 'service token mismatch'}`,
      );
      throw new UnauthorizedException('Invalid service token.');
    }
    return true;
  }

  private matches(presented: string): boolean {
    return timingSafeEqual(sha256(presented), this.expectedDigest);
  }
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/** Extracts `<token>` from `Bearer <token>`; null for anything else. */
function bearerToken(header: string | undefined): string | null {
  const [scheme, token, ...rest] = (header ?? '').trim().split(/\s+/);
  if (rest.length > 0 || scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
}
