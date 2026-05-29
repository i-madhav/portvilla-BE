import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { LoginWithOtpDto } from './dto/login-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { MessageResponseDto, TokenResponseDto } from './dto/auth-response.dto';

import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './interfaces/jwt.interface';

import {
  RegisterEndpoint,
  VerifyEmailEndpoint,
  ResendOtpEndpoint,
  LoginEndpoint,
  RequestLoginOtpEndpoint,
  LoginWithOtpEndpoint,
  RefreshTokensEndpoint,
  LogoutEndpoint,
} from './swagger/auth.swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Registration ──────────────────────────────────────────────────────────

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @RegisterEndpoint()
  async register(@Body() dto: RegisterDto): Promise<MessageResponseDto> {
    await this.authService.register(dto);
    return { message: 'Account created. Please check your email for the verification code.' };
  }

  // ─── Email Verification ────────────────────────────────────────────────────

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @VerifyEmailEndpoint()
  async verifyEmail(@Body() dto: VerifyOtpDto): Promise<MessageResponseDto> {
    await this.authService.verifyEmail(dto);
    return { message: 'Email verified successfully. You can now log in.' };
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ResendOtpEndpoint()
  async resendOtp(@Body() dto: SendOtpDto): Promise<MessageResponseDto> {
    await this.authService.resendVerificationOtp(dto.email);
    return { message: 'A new verification code has been sent to your email.' };
  }

  // ─── Password-based Login ──────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @LoginEndpoint()
  async login(@Body() dto: LoginDto): Promise<TokenResponseDto> {
    return this.authService.login(dto);
  }

  // ─── Passwordless OTP Login ────────────────────────────────────────────────

  @Post('login/otp/request')
  @HttpCode(HttpStatus.OK)
  @RequestLoginOtpEndpoint()
  async requestLoginOtp(@Body() dto: SendOtpDto): Promise<MessageResponseDto> {
    await this.authService.requestLoginOtp(dto.email);
    return { message: 'Login code sent. Please check your email.' };
  }

  @Post('login/otp')
  @HttpCode(HttpStatus.OK)
  @LoginWithOtpEndpoint()
  async loginWithOtp(@Body() dto: LoginWithOtpDto): Promise<TokenResponseDto> {
    return this.authService.loginWithOtp(dto);
  }

  // ─── Token Management ──────────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RefreshTokensEndpoint()
  async refresh(@Body() dto: RefreshTokenDto): Promise<TokenResponseDto> {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @LogoutEndpoint()
  async logout(@CurrentUser() user: JwtPayload): Promise<MessageResponseDto> {
    await this.authService.logout(user.sub);
    return { message: 'Logged out successfully.' };
  }
}
