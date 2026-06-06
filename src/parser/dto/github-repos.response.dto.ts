import { ApiProperty } from '@nestjs/swagger';
import { GithubRepository, RepoInsights } from '../core/parsed-profile.types';

export class RepoInsightsDto implements RepoInsights {
  @ApiProperty({
    example: { TypeScript: 123456, JavaScript: 4321 },
    description: 'Byte count per language as reported by GitHub',
  })
  languages!: Record<string, number>;

  @ApiProperty({
    example: ['CI/CD', 'Docker', 'Testing', 'ESLint'],
    type: [String],
    description: 'Tooling/practices detected from root config files',
  })
  detectedTools!: string[];

  @ApiProperty({
    example: ['NestJS', 'Prisma', 'Zod'],
    type: [String],
    description: 'Frameworks/libraries detected from package.json or requirements.txt',
  })
  frameworks!: string[];

  @ApiProperty({
    example: '# My Project\nA cool tool that does X...',
    nullable: true,
    description: 'Raw README markdown content, if one exists at the repo root',
  })
  readme!: string | null;
}

export class GithubRepositoryDto implements GithubRepository {
  @ApiProperty({ example: 'linux' })
  name!: string;

  @ApiProperty({ example: 'torvalds/linux' })
  fullName!: string;

  @ApiProperty({ example: 'https://github.com/torvalds/linux' })
  url!: string;

  @ApiProperty({ example: 'Linux kernel source tree', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 'C', nullable: true })
  language!: string | null;

  @ApiProperty({ example: 170000 })
  stars!: number;

  @ApiProperty({ example: 52000 })
  forks!: number;

  @ApiProperty({ example: false })
  isForked!: boolean;

  @ApiProperty({ example: ['kernel', 'linux'], type: [String] })
  topics!: string[];

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  updatedAt!: string;

  @ApiProperty({ type: RepoInsightsDto })
  insights!: RepoInsightsDto;
}
