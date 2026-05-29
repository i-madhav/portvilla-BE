import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { USER_REPOSITORY } from '../auth/domain/user-repository.interface';
import type { IUserRepository } from '../auth/domain/user-repository.interface';
import { ProfileResponseDto } from './dto/profile-response.dto';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {}

  /**
   * Fetches the authenticated user's record and returns a safe, public-facing
   * subset. Sensitive fields (passwordHash, refreshTokenHash) are never
   * included in the returned object.
   */
  async getMe(userId: string): Promise<ProfileResponseDto> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
