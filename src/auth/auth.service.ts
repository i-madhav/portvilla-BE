import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';

import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginWithOtpDto } from './dto/login-otp.dto';
import { JwtPayload, JwtTokenPair } from './interfaces/jwt.interface';
import { IUserRecord } from './interfaces/user.interface';
import { OtpPurpose } from './interfaces/otp.interface';
import { USER_REPOSITORY } from './domain/user-repository.interface';
import type { IUserRepository } from './domain/user-repository.interface';
import { OTP_REPOSITORY } from './domain/otp-repository.interface';
import type { IOtpRepository } from './domain/otp-repository.interface';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly otpExpiryMinutes: number;
  private readonly jwtAccessSecret: string;
  private readonly jwtRefreshSecret: string;
  /** Expiry in seconds — passed directly to jsonwebtoken as a number. */
  private readonly jwtAccessExpirySeconds: number;
  private readonly jwtRefreshExpirySeconds: number;

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(OTP_REPOSITORY) private readonly otpRepository: IOtpRepository,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    // configService is consumed only during construction; not stored as a field.
    configService: ConfigService,
  ) {
    this.otpExpiryMinutes = Number(
      configService.getOrThrow<string>('OTP_EXPIRY_MINUTES'),
    );
    this.jwtAccessSecret = configService.getOrThrow('JWT_ACCESS_SECRET');
    this.jwtRefreshSecret = configService.getOrThrow('JWT_REFRESH_SECRET');
    this.jwtAccessExpirySeconds = Number(
      configService.getOrThrow('JWT_ACCESS_EXPIRY_SECONDS'),
    );
    this.jwtRefreshExpirySeconds = Number(
      configService.getOrThrow('JWT_REFRESH_EXPIRY_SECONDS'),
    );
  }

  // ─── Registration ─────────────────────────────────────────────────────────

  /**
   * Creates a new user account and dispatches an email-verification OTP.
   * Throws ConflictException if the email is already registered.
   */
  async register(dto: RegisterDto): Promise<void> {
    const exists = await this.userRepository.existsByEmail(dto.email);
    if (exists) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.userRepository.create({ email: dto.email, passwordHash });

    await this.issueAndSendOtp(dto.email, OtpPurpose.EMAIL_VERIFICATION);
  }

  // ─── Email Verification ───────────────────────────────────────────────────

  /**
   * Validates the OTP and marks the user's email as verified.
   */
  async verifyEmail(dto: VerifyOtpDto): Promise<void> {
    const user = await this.requireUser(dto.email);

    await this.validateOtp(dto.email, dto.otp, OtpPurpose.EMAIL_VERIFICATION);

    await this.userRepository.markEmailVerified(user.id);
    await this.otpRepository.deleteByEmailAndPurpose(
      dto.email,
      OtpPurpose.EMAIL_VERIFICATION,
    );
  }

  /**
   * Issues a fresh email-verification OTP.
   * Throws ConflictException if the email is already verified.
   */
  async resendVerificationOtp(email: string): Promise<void> {
    const user = await this.requireUser(email);

    if (user.isEmailVerified) {
      throw new ConflictException('This email address is already verified.');
    }

    await this.issueAndSendOtp(email, OtpPurpose.EMAIL_VERIFICATION);
  }

  // ─── Password-based Login ─────────────────────────────────────────────────

  /**
   * Authenticates a user with email + password.
   * Returns a JWT access/refresh token pair on success.
   */
  async login(dto: LoginDto): Promise<JwtTokenPair> {
    const user = await this.requireUser(dto.email);
    await this.requireEmailVerified(user);

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.issueTokenPair(user);
  }

  // ─── Passwordless OTP Login ───────────────────────────────────────────────

  /**
   * Step 1: Sends a one-time login OTP to the registered email.
   */
  async requestLoginOtp(email: string): Promise<void> {
    const user = await this.requireUser(email);
    await this.requireEmailVerified(user);

    await this.issueAndSendOtp(email, OtpPurpose.LOGIN);
  }

  /**
   * Step 2: Validates the login OTP and returns a JWT token pair.
   */
  async loginWithOtp(dto: LoginWithOtpDto): Promise<JwtTokenPair> {
    const user = await this.requireUser(dto.email);
    await this.requireEmailVerified(user);

    await this.validateOtp(dto.email, dto.otp, OtpPurpose.LOGIN);

    await this.otpRepository.deleteByEmailAndPurpose(dto.email, OtpPurpose.LOGIN);

    return this.issueTokenPair(user);
  }

  // ─── Token Refresh ────────────────────────────────────────────────────────

  /**
   * Validates the refresh token and rotates the token pair.
   * Throws UnauthorizedException if the token is invalid, expired, or revoked.
   */
  async refreshTokens(refreshToken: string): Promise<JwtTokenPair> {
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    const user = await this.userRepository.findById(payload.sub);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Session has been revoked. Please log in again.');
    }

    const tokenMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!tokenMatch) {
      // Possible token reuse — revoke session immediately.
      await this.userRepository.setRefreshTokenHash(user.id, null);
      throw new UnauthorizedException('Refresh token has already been used. Please log in again.');
    }

    return this.issueTokenPair(user);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  /**
   * Revokes the stored refresh token for the given user id.
   */
  async logout(userId: string): Promise<void> {
    await this.userRepository.setRefreshTokenHash(userId, null);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async requireUser(email: string): Promise<IUserRecord> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException('No account found for this email address.');
    }
    return user;
  }

  private async requireEmailVerified(user: IUserRecord): Promise<void> {
    if (!user.isEmailVerified) {
      throw new ForbiddenException(
        'Email address is not verified. Please verify your email first.',
      );
    }
  }

  /**
   * Generates a plain OTP, hashes and persists it, then emails it to the user.
   */
  private async issueAndSendOtp(
    email: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    const expiresAt = new Date(
      Date.now() + this.otpExpiryMinutes * 60 * 1000,
    );

    await this.otpRepository.upsert({ email, otpHash, purpose, expiresAt });
    await this.mailService.sendOtp(email, otp, this.otpExpiryMinutes);
  }

  /**
   * Verifies a plain OTP against the stored hash and checks expiry.
   * Throws UnprocessableEntityException on mismatch or expiry.
   */
  private async validateOtp(
    email: string,
    otp: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const record = await this.otpRepository.findLatest(email, purpose);

    if (!record || record.expiresAt < new Date()) {
      throw new UnprocessableEntityException('OTP has expired. Please request a new one.');
    }

    const isValid = await bcrypt.compare(otp, record.otpHash);
    if (!isValid) {
      throw new UnprocessableEntityException('Invalid OTP. Please check the code and try again.');
    }
  }

  /**
   * Signs and returns a fresh access/refresh token pair.
   * The refresh token hash is persisted for later validation.
   */
  private async issueTokenPair(user: IUserRecord): Promise<JwtTokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.jwtAccessSecret,
        expiresIn: this.jwtAccessExpirySeconds,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.jwtRefreshSecret,
        expiresIn: this.jwtRefreshExpirySeconds,
      }),
    ]);

    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.userRepository.setRefreshTokenHash(user.id, refreshTokenHash);

    return { accessToken, refreshToken };
  }

  /** Generates a cryptographically random 6-digit OTP string. */
  private generateOtp(): string {
    return String(randomInt(100_000, 1_000_000)).padStart(6, '0');
  }
}
