import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class SummarizeRepoDto {
  @ApiProperty({ example: 'i-madhav/portvilla-BE', description: 'Full repo name: owner/repo' })
  @IsString()
  @Matches(/^[\w.-]+\/[\w.-]+$/, { message: 'repoFullName must be in owner/repo format' })
  repoFullName!: string;
}

export class SummarizeRepoResponseDto {
  @ApiProperty({ example: 'A NestJS + Mongoose REST API powering Portvilla...' })
  summary!: string;
}
