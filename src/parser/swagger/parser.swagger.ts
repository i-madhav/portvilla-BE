import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { GithubProfileResponseDto } from '../dto/github-profile.response.dto';
import { SummarizeRepoDto, SummarizeRepoResponseDto } from '../dto/summarize-repo.dto';

// ─── Shared ───────────────────────────────────────────────────────────────────

const Unauthorized = (): MethodDecorator =>
  applyDecorators(
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Access token is missing, invalid, or expired.',
    }),
  );

// ─── GET /parser/github/:username ─────────────────────────────────────────────

export const GetGithubProfileEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Fetch GitHub profile',
      description:
        'Returns a combined GitHub profile — user info, top repositories (by stars), ' +
        'current-year contribution count, per-repo language breakdown, detected tooling, ' +
        'detected frameworks, and README content — in a single response. ' +
        'Requires a valid Bearer access token.',
    }),
    ApiParam({ name: 'username', example: 'torvalds', description: 'GitHub username' }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'GitHub profile fetched successfully.',
      type: GithubProfileResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'GitHub user not found.',
    }),
    ApiResponse({
      status: HttpStatus.TOO_MANY_REQUESTS,
      description: 'GitHub API rate limit exceeded.',
    }),
    ApiResponse({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      description: 'GitHub API is unreachable.',
    }),
    Unauthorized(),
  );

// ─── POST /parser/github/summarize ────────────────────────────────────────────

export const SummarizeRepoEndpoint = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Generate AI repo summary',
      description:
        'Fetches the repo README + tech stack, then generates a 2-3 sentence project summary ' +
        'using the AI provider configured in the authenticated user\'s profile settings. ' +
        'The summary is returned but not persisted — the client decides where to save it.',
    }),
    ApiBody({ type: SummarizeRepoDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Summary generated successfully.',
      type: SummarizeRepoResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Invalid repo name format or AI provider API key not configured.',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'User profile not found.',
    }),
    Unauthorized(),
  );
