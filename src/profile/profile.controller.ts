import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt.interface';

import { ProfileService } from './profile.service';
import { ProfileOwnerGuard, type ProfileRequest } from './guards/profile-owner.guard';

import { ProfileResponseDto } from './dto/profile-response.dto';
import { ProfileDataResponseDto } from './dto/profile-data-response.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { resumeUploadConfig, profileImageUploadConfig } from './upload/upload.config';

import {
  GetMeEndpoint,
  CreateProfileEndpoint,
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

  // ─── Auth user record (unchanged) ─────────────────────────────────────────

  @Get('profile/me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @GetMeEndpoint()
  getMe(@CurrentUser() user: JwtPayload): Promise<ProfileResponseDto> {
    return this.profileService.getMe(user.sub);
  }

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

  @Get('profiles/me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @GetProfileDataEndpoint()
  getProfileData(@CurrentUser() user: JwtPayload): Promise<ProfileDataResponseDto> {
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
  ): Promise<ProfileDataResponseDto> {
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
