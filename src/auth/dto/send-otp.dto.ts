import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address to send the OTP to.',
  })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email: string;
}
