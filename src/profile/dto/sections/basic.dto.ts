import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BasicInfoDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Senior Software Engineer' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: 'Passionate engineer with 8 years of experience...' })
  @IsString()
  @IsOptional()
  introduction?: string;

  @ApiPropertyOptional({ example: 'I love building distributed systems...' })
  @IsString()
  @IsOptional()
  aboutMe?: string;
}
