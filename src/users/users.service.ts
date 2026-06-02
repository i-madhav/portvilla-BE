import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { USER_REPOSITORY } from '../auth/domain/user-repository.interface';
import type { IUserRepository } from '../auth/domain/user-repository.interface';

import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {}

  async getMe(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found.');
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
