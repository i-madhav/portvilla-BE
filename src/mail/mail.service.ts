import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { buildOtpEmailHtml } from './templates/otp-email.template';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {
    this.from = configService.getOrThrow<string>('MAIL_FROM');

    this.transporter = nodemailer.createTransport({
      host: configService.getOrThrow<string>('MAIL_HOST'),
      port: configService.getOrThrow<number>('MAIL_PORT'),
      secure: false, // STARTTLS on port 587
      auth: {
        user: configService.getOrThrow<string>('MAIL_USER'),
        pass: configService.getOrThrow<string>('MAIL_PASSWORD'),
      },
    });
  }

  /**
   * Sends an OTP code to the given email address.
   *
   * @param to           Recipient email address.
   * @param otp          The plain-text OTP (not the hash).
   * @param expiryMinutes How many minutes until the OTP expires (shown in the email body).
   */
  async sendOtp(to: string, otp: string, expiryMinutes: number): Promise<void> {
    const html = buildOtpEmailHtml(otp, expiryMinutes);

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Your Portvilla verification code',
        html,
      });
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${to}`, error);
      throw new InternalServerErrorException(
        'Failed to send verification email. Please try again.',
      );
    }
  }
}
