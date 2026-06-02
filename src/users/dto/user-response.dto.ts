import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../auth/interfaces/user.interface';

export class UserResponseDto {
  @ApiProperty({ example: '6650a1b2c3d4e5f6a7b8c9d0' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role!: UserRole;

  @ApiProperty({ example: true })
  isEmailVerified!: boolean;

  @ApiProperty({ example: '2026-05-30T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-05-30T00:00:00.000Z' })
  updatedAt!: Date;
}
