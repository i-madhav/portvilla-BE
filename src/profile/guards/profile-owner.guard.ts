import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';

import { PROFILE_REPOSITORY } from '../domain/profile-repository.interface';
import type { IProfileRepository } from '../domain/profile-repository.interface';
import type { IProfileRecord } from '../domain/profile.interface';
import type { JwtPayload } from '../../auth/interfaces/jwt.interface';

/** Augment the Express Request type so TypeScript knows about request.profile. */
export interface ProfileRequest extends Request {
  user: JwtPayload;
  profile: IProfileRecord;
}

/**
 * Verifies that the authenticated user owns a profile and attaches it to
 * request.profile, eliminating a redundant DB round-trip in the service.
 * Apply after JwtAuthGuard on any route that requires an existing profile.
 */
@Injectable()
export class ProfileOwnerGuard implements CanActivate {
  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ProfileRequest>();
    const userId = req.user.sub;

    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Profile not found. Complete onboarding first.');
    }

    req.profile = profile;
    return true;
  }
}
