import { ApiProperty } from '@nestjs/swagger';

/** Generic message response used for operations that return no data. */
export class MessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully.' })
  message: string;
}

/** Returned after a successful login or token refresh. */
export class TokenResponseDto {
  @ApiProperty({
    description: 'Short-lived JWT for authenticating API requests.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Long-lived JWT used to obtain a new access token.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;
}
