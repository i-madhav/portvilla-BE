import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/** Query params for GET /profiles/username-available. */
export class UsernameAvailabilityQueryDto {
  @ApiProperty({
    example: 'jane-doe',
    description: 'Candidate username to check.',
  })
  @IsString()
  username!: string;
}

export type UsernameUnavailableReason = 'taken' | 'reserved' | 'invalid';

export class UsernameAvailabilityDto {
  @ApiProperty({ description: 'Whether the username can be claimed.' })
  available!: boolean;

  @ApiProperty({
    nullable: true,
    enum: ['taken', 'reserved', 'invalid'],
    description: 'Why it is unavailable, or null when available.',
  })
  reason!: UsernameUnavailableReason | null;
}
