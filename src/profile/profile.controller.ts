import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Patch,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt.interface';

import { ProfileService } from './profile.service';
import {
  ProfileOwnerGuard,
  type ProfileRequest,
} from './guards/profile-owner.guard';

import { ProfileDataResponseDto } from './dto/profile-data-response.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  UsernameAvailabilityDto,
  UsernameAvailabilityQueryDto,
} from './dto/username-availability.dto';
import { PublicProfileResponseDto } from './dto/public-profile-response.dto';
import { UnlockProfileDto } from './dto/unlock-profile.dto';
import { ResumeUploadResponseDto } from './dto/resume-upload-response.dto';
import {
  resumeUploadConfig,
  profileImageUploadConfig,
} from './upload/upload.config';

import {
  CreateProfileEndpoint,
  CheckUsernameEndpoint,
  GetPublicProfileEndpoint,
  UnlockPublicProfileEndpoint,
  GetProfileDataEndpoint,
  UploadResumeEndpoint,
  UploadProfileImageEndpoint,
  DeleteProfileEndpoint,
  UpdateProfileEndpoint,
} from './swagger/profile.swagger';

// Decorator to extract the pre-fetched profile from the guard
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { IProfileRecord } from './domain/profile.interface';

const ProfileFromGuard = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IProfileRecord => {
    const req = ctx.switchToHttp().getRequest<ProfileRequest>();
    return req.profile;
  },
);

@ApiTags('Profile')
@Controller()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // ─── Profile CRUD ──────────────────────────────────────────────────────────

  @Post('profiles')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @CreateProfileEndpoint()
  createProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateProfileDto,
  ): Promise<ProfileDataResponseDto> {
    return this.profileService.createProfile(user.sub, dto);
  }

  // Public — no guard. A literal path, declared before any ':username' route so
  // it can never be shadowed by a param match.
  @Get('profiles/username-available')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @CheckUsernameEndpoint()
  checkUsername(
    @Query() query: UsernameAvailabilityQueryDto,
  ): Promise<UsernameAvailabilityDto> {
    return this.profileService.checkUsernameAvailability(query.username);
  }

  // Public — the visitor-facing portfolio. `public/` prefix keeps `:username`
  // from colliding with the literal `me` / `username-available` routes.
  @Get('profiles/public/:username')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @GetPublicProfileEndpoint()
  getPublicProfile(
    @Param('username') username: string,
  ): Promise<PublicProfileResponseDto> {
    return this.profileService.getPublicProfile(username);
  }

  // Tight limit: this is the brute-force surface for a protected profile's password.
  @Post('profiles/public/:username/unlock')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UnlockPublicProfileEndpoint()
  unlockPublicProfile(
    @Param('username') username: string,
    @Body() dto: UnlockProfileDto,
  ): Promise<PublicProfileResponseDto> {
    return this.profileService.unlockPublicProfile(username, dto.password);
  }

  @Get('profiles/me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @GetProfileDataEndpoint()
  getProfileData(
    @CurrentUser() user: JwtPayload,
  ): Promise<ProfileDataResponseDto> {
    return this.profileService.getProfileData(user.sub);
  }

  @Patch('profiles/me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, ProfileOwnerGuard)
  @UpdateProfileEndpoint()
  updateProfile(
    @ProfileFromGuard() profile: IProfileRecord,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileDataResponseDto> {
    return this.profileService.updateProfile(profile.id, dto);
  }

  @Post('profiles/me/resume')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, ProfileOwnerGuard)
  @UseInterceptors(FileInterceptor('resume', resumeUploadConfig))
  @UploadResumeEndpoint()
  uploadResume(
    @ProfileFromGuard() profile: IProfileRecord,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ResumeUploadResponseDto> {
    return this.profileService.uploadResume(profile.id, file);
  }

  @Post('profiles/me/profile-image')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, ProfileOwnerGuard)
  @UseInterceptors(FileInterceptor('profileImage', profileImageUploadConfig))
  @UploadProfileImageEndpoint()
  uploadProfileImage(
    @ProfileFromGuard() profile: IProfileRecord,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ProfileDataResponseDto> {
    return this.profileService.uploadProfileImage(profile.id, file);
  }

  @Delete('profiles/me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @DeleteProfileEndpoint()
  deleteProfile(@CurrentUser() user: JwtPayload): Promise<void> {
    return this.profileService.deleteProfile(user.sub);
  }
}
