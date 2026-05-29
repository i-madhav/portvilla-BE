import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { SendOtpDto } from '../dto/send-otp.dto';
import { LoginWithOtpDto } from '../dto/login-otp.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { MessageResponseDto, TokenResponseDto } from '../dto/auth-response.dto';

// ─── Shared response descriptions ────────────────────────────────────────────

const VALIDATION_ERROR = ApiResponse({
  status: HttpStatus.BAD_REQUEST,
  description: 'One or more request fields failed validation.',
});

const UNAUTHORIZED = ApiResponse({
  status: HttpStatus.UNAUTHORIZED,
  description: 'The provided credentials are invalid or the token has expired.',
});

const NOT_FOUND_USER = ApiResponse({
  status: HttpStatus.NOT_FOUND,
  description: 'No account found for the given email address.',
});

const TOO_MANY_REQUESTS = ApiResponse({
  status: HttpStatus.TOO_MANY_REQUESTS,
  description: 'Rate limit exceeded. Please wait before retrying.',
});

// ─── Endpoint decorators ─────────────────────────────────────────────────────
// Each exported function returns a composed MethodDecorator that is imported
// and applied in auth.controller.ts. Swagger docs live exclusively here.

/**
 * POST /auth/register
 * Creates a new user account and dispatches an email-verification OTP.
 */
export const RegisterEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiOperation({
      summary: 'Register a new user',
      description:
        'Creates a new user account with the supplied email and password. ' +
        'A 6-digit one-time password (OTP) is sent to the provided email ' +
        'address. The account cannot be used to log in until the email is ' +
        'verified via **POST /auth/verify-email**.',
    }),
    ApiBody({ type: RegisterDto }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description:
        'Account created successfully. Verification OTP dispatched.',
      type: MessageResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'An account with this email address already exists.',
    }),
    VALIDATION_ERROR,
  );

/**
 * POST /auth/verify-email
 * Confirms the email address using the OTP sent during registration (or resent
 * via POST /auth/resend-otp).
 */
export const VerifyEmailEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiOperation({
      summary: 'Verify email address',
      description:
        'Validates the 6-digit OTP sent to the user\'s email address. ' +
        'On success the account is marked as verified and can be used to log in. ' +
        'OTPs expire after **15 minutes**.',
    }),
    ApiBody({ type: VerifyOtpDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Email verified successfully.',
      type: MessageResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description: 'OTP is invalid or has expired.',
    }),
    NOT_FOUND_USER,
    VALIDATION_ERROR,
  );

/**
 * POST /auth/resend-otp
 * Issues a fresh email-verification OTP, invalidating any previous one.
 */
export const ResendOtpEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiOperation({
      summary: 'Resend email-verification OTP',
      description:
        'Generates a new 6-digit OTP and emails it to the specified address. ' +
        'Any previously issued OTP for that email is invalidated. ' +
        'Only valid for accounts that are **not yet verified**.',
    }),
    ApiBody({ type: SendOtpDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'New OTP dispatched.',
      type: MessageResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Email is already verified; no OTP is needed.',
    }),
    NOT_FOUND_USER,
    TOO_MANY_REQUESTS,
    VALIDATION_ERROR,
  );

/**
 * POST /auth/login
 * Authenticates via email + password and returns a JWT access/refresh pair.
 */
export const LoginEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiOperation({
      summary: 'Login with email and password',
      description:
        'Validates credentials and returns a short-lived **access token** ' +
        '(15 min) and a long-lived **refresh token** (7 days). ' +
        'The email address must be verified before login is permitted.',
    }),
    ApiBody({ type: LoginDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Login successful.',
      type: TokenResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Email address has not been verified.',
    }),
    UNAUTHORIZED,
    VALIDATION_ERROR,
  );

/**
 * POST /auth/login/otp/request
 * Step 1 of the passwordless OTP login flow — sends an OTP to the email.
 */
export const RequestLoginOtpEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiOperation({
      summary: 'Request a login OTP (passwordless — step 1)',
      description:
        'Sends a 6-digit OTP to the registered email address. ' +
        'Complete the login by calling **POST /auth/login/otp** with ' +
        'the email and the received OTP. OTPs expire after **15 minutes**.',
    }),
    ApiBody({ type: SendOtpDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Login OTP dispatched.',
      type: MessageResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Email address has not been verified.',
    }),
    NOT_FOUND_USER,
    TOO_MANY_REQUESTS,
    VALIDATION_ERROR,
  );

/**
 * POST /auth/login/otp
 * Step 2 of the passwordless OTP login flow — exchange OTP for tokens.
 */
export const LoginWithOtpEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiOperation({
      summary: 'Login with OTP (passwordless — step 2)',
      description:
        'Validates the 6-digit OTP previously sent to the email address and, ' +
        'on success, returns a JWT access/refresh pair identical to the ' +
        'password-based login response.',
    }),
    ApiBody({ type: LoginWithOtpDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'OTP verified. Login successful.',
      type: TokenResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description: 'OTP is invalid or has expired.',
    }),
    NOT_FOUND_USER,
    VALIDATION_ERROR,
  );

/**
 * POST /auth/refresh
 * Issues a new access/refresh token pair using a valid refresh token.
 */
export const RefreshTokensEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiOperation({
      summary: 'Refresh access token',
      description:
        'Exchanges a valid refresh token for a brand-new access/refresh pair. ' +
        'The old refresh token is invalidated (rotation). ' +
        'If the user has logged out or the token has been revoked, ' +
        'a **401 Unauthorized** is returned.',
    }),
    ApiBody({ type: RefreshTokenDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Tokens refreshed.',
      type: TokenResponseDto,
    }),
    UNAUTHORIZED,
    VALIDATION_ERROR,
  );

/**
 * POST /auth/logout
 * Revokes the stored refresh token for the authenticated user.
 */
export const LogoutEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Logout',
      description:
        'Revokes the refresh token stored for the current user. ' +
        'The client should discard both the access and refresh tokens. ' +
        'Requires a valid Bearer access token in the `Authorization` header.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Logged out successfully.',
      type: MessageResponseDto,
    }),
    UNAUTHORIZED,
  );
