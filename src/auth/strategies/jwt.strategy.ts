import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { USER_REPOSITORY } from '../domain/user-repository.interface';
import type { IUserRepository } from '../domain/user-repository.interface';
import type { JwtPayload } from '../interfaces/jwt.interface';

export const JWT_STRATEGY = 'jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, JWT_STRATEGY) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    configService: ConfigService,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /** Called by Passport after signature verification. Attaches result to req.user. */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    this.logger.debug(`validate: access token verified, loading user (userId=${payload.sub})`);
    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      this.logger.warn(`validate: token references a user that no longer exists (userId=${payload.sub})`);
      throw new UnauthorizedException('User no longer exists.');
    }
    return payload;
  }
}
