import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JWT_STRATEGY } from '../strategies/jwt.strategy';

/** Apply to any route that requires a valid Bearer access token. */
@Injectable()
export class JwtAuthGuard extends AuthGuard(JWT_STRATEGY) {}
