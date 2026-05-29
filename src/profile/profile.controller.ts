import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt.interface';

import { ProfileService } from './profile.service';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { GetMeEndpoint } from './swagger/profile.swagger';

@ApiTags('Profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @GetMeEndpoint()
  getMe(@CurrentUser() user: JwtPayload): Promise<ProfileResponseDto> {
    return this.profileService.getMe(user.sub);
  }
}
