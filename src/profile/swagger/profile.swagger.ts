import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { ProfileDataResponseDto } from '../dto/profile-data-response.dto';
import { CreateProfileDto } from '../dto/create-profile.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UsernameAvailabilityDto } from '../dto/username-availability.dto';
import { PublicProfileResponseDto } from '../dto/public-profile-response.dto';
import { UnlockProfileDto } from '../dto/unlock-profile.dto';
import { ResumeUploadResponseDto } from '../dto/resume-upload-response.dto';

// ─── Shared ───────────────────────────────────────────────────────────────────

const Bearer = (): MethodDecorator => applyDecorators(ApiBearerAuth());

const ProfileNotFound = (): MethodDecorator =>
  applyDecorators(
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Profile not found.',
    }),
  );

const Unauthorized = (): MethodDecorator =>
  applyDecorators(
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Access token is missing, invalid, or expired.',
    }),
  );

// ─── POST /profiles ───────────────────────────────────────────────────────────

export const CreateProfileEndpoint = (): MethodDecorator =>
  applyDecorators(
    Bearer(),
    ApiOperation({
      summary: 'Create profile (onboarding)',
      description:
        'Creates the profile document for the authenticated user. ' +
        'Can only be called once — returns 409 if a profile already exists or the username is taken.',
    }),
    ApiBody({ type: CreateProfileDto }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Profile created successfully.',
      type: ProfileDataResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Profile already exists or username is taken/reserved.',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Validation error.',
    }),
    Unauthorized(),
  );

// ─── GET /profiles/username-available ────────────────────────────────────────

export const CheckUsernameEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiOperation({
      summary: 'Check username availability',
      description:
        'Public. Returns whether a username can be claimed, with a structured reason ' +
        '(`taken` | `reserved` | `invalid`) when it cannot. A malformed candidate returns ' +
        '`available: false, reason: "invalid"` rather than a 400.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Availability result.',
      type: UsernameAvailabilityDto,
    }),
  );

// ─── GET /profiles/public/:username ──────────────────────────────────────────

export const GetPublicProfileEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiOperation({
      summary: 'Get a public profile by username',
      description:
        'Public. Returns the allowlisted public profile. A private profile returns 404 ' +
        '(indistinguishable from a nonexistent one). A password-protected profile returns 401 ' +
        'with `{ protected: true }` and no body — unlock via POST /profiles/public/:username/unlock.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Public profile.',
      type: PublicProfileResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Profile is password-protected.',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'No public profile at this username.',
    }),
  );

// ─── POST /profiles/public/:username/unlock ──────────────────────────────────

export const UnlockPublicProfileEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiOperation({
      summary: 'Unlock a password-protected profile',
      description:
        'Public. Exchanges the access password for the profile body. Wrong password returns 401.',
    }),
    ApiBody({ type: UnlockProfileDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Public profile.',
      type: PublicProfileResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Incorrect password.',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'No public profile at this username.',
    }),
  );

// ─── GET /profiles/me ────────────────────────────────────────────────────────

export const GetProfileDataEndpoint = (): MethodDecorator =>
  applyDecorators(
    Bearer(),
    ApiOperation({
      summary: 'Get own profile data',
      description:
        'Returns the full profile record for the authenticated user. The raw AI API key is never returned; `aiSettings.apiKeyConfigured` indicates whether one is saved.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Profile data retrieved successfully.',
      type: ProfileDataResponseDto,
    }),
    ProfileNotFound(),
    Unauthorized(),
  );

// ─── PATCH /profiles/me ──────────────────────────────────────────────────────

export const UpdateProfileEndpoint = (): MethodDecorator =>
  applyDecorators(
    Bearer(),
    ApiOperation({
      summary: 'Update profile (any combination of sections)',
      description:
        'Send only the sections you want to update. Each section is independently optional. ' +
        'Within a section, individual fields are also optional. ' +
        'When `visibility.visibility` is `PROTECTED`, `visibility.protectedPassword` is required.',
    }),
    ApiBody({ type: UpdateProfileDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Profile updated.',
      type: ProfileDataResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description:
        'Validation error (e.g. PROTECTED visibility without a password).',
    }),
    ProfileNotFound(),
    Unauthorized(),
  );

// ─── POST /profiles/me/resume ─────────────────────────────────────────────────

export const UploadResumeEndpoint = (): MethodDecorator =>
  applyDecorators(
    Bearer(),
    ApiOperation({
      summary: 'Upload resume PDF (max 5 MB)',
      description:
        'Stores the resume, extracts its text to identity.resume.parsedText, and — best effort — ' +
        'returns draft `suggestions` (skills / journey / work) for the user to review. ' +
        'Suggestions are never persisted by the server; `suggestions` is null when extraction ' +
        'is unavailable or the PDF carried no readable text.',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['resume'],
        properties: { resume: { type: 'string', format: 'binary' } },
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description:
        'Resume uploaded; profile + optional draft suggestions returned.',
      type: ResumeUploadResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'File must be PDF, max 5 MB.',
    }),
    ProfileNotFound(),
    Unauthorized(),
  );

// ─── POST /profiles/me/profile-image ─────────────────────────────────────────

export const UploadProfileImageEndpoint = (): MethodDecorator =>
  applyDecorators(
    Bearer(),
    ApiOperation({
      summary: 'Upload profile image (JPEG / PNG / WebP, max 2 MB)',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['profileImage'],
        properties: { profileImage: { type: 'string', format: 'binary' } },
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description:
        'Profile image uploaded. URL saved to identity.primaryImage.',
      type: ProfileDataResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'File must be JPEG/PNG/WebP, max 2 MB.',
    }),
    ProfileNotFound(),
    Unauthorized(),
  );

// ─── DELETE /profiles/me ─────────────────────────────────────────────────────

export const DeleteProfileEndpoint = (): MethodDecorator =>
  applyDecorators(
    Bearer(),
    ApiOperation({ summary: 'Delete own profile and all associated data' }),
    ApiResponse({
      status: HttpStatus.NO_CONTENT,
      description: 'Profile deleted.',
    }),
    ProfileNotFound(),
    Unauthorized(),
  );
