import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateBasicDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Principal Engineer' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'Passionate engineer with 8 years of experience...' })
  @IsString()
  @IsOptional()
  introduction?: string;

  @ApiPropertyOptional({ example: 'I love building distributed systems...' })
  @IsString()
  @IsOptional()
  aboutMe?: string;
}
