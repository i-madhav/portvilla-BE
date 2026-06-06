import { ApiProperty } from '@nestjs/swagger';
import { GithubProfile } from '../core/parsed-profile.types';
import { GithubRepositoryDto } from './github-repos.response.dto';

export class GithubProfileResponseDto implements GithubProfile {
  @ApiProperty({ example: 'torvalds' })
  username!: string;

  @ApiProperty({ example: 'Linus Torvalds', nullable: true })
  name!: string | null;

  @ApiProperty({ example: 'Just a random Linux and git kernel maintainer', nullable: true })
  bio!: string | null;

  @ApiProperty({ example: 'Linux Foundation', nullable: true })
  company!: string | null;

  @ApiProperty({ example: 'Portland, OR', nullable: true })
  location!: string | null;

  @ApiProperty({ example: null, nullable: true })
  email!: string | null;

  @ApiProperty({ example: '', nullable: true })
  blog!: string | null;

  @ApiProperty({ example: 'https://avatars.githubusercontent.com/u/1024025' })
  avatarUrl!: string;

  @ApiProperty({ example: 'https://github.com/torvalds' })
  profileUrl!: string;

  @ApiProperty({ example: 230000 })
  followers!: number;

  @ApiProperty({ example: 0 })
  following!: number;

  @ApiProperty({ example: 7 })
  publicRepos!: number;

  @ApiProperty({ example: 0 })
  publicGists!: number;

  @ApiProperty({ type: [GithubRepositoryDto] })
  topRepositories!: GithubRepositoryDto[];

  @ApiProperty({ example: 42, description: 'Push/PR/issue/create events in the current calendar year' })
  contributions!: number;

  @ApiProperty({ example: '2011-09-03T15:26:22Z' })
  createdAt!: string;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  updatedAt!: string;
}
