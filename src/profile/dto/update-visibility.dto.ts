import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

import { ProfileVisibility } from '../domain/profile.interface';

export class UpdateVisibilityDto {
  @ApiProperty({ enum: ProfileVisibility, example: ProfileVisibility.PUBLIC })
  @IsEnum(ProfileVisibility)
  visibility!: ProfileVisibility;

  @ApiPropertyOptional({
    example: 'mySecret123',
    description: 'Required when visibility is PROTECTED. Minimum 6 characters.',
  })
  @ValidateIf((o: UpdateVisibilityDto) => o.visibility === ProfileVisibility.PROTECTED)
  @IsString()
  @MinLength(6)
  @IsOptional()
  protectedPassword?: string;
}
