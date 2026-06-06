import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt.interface';
import { ParserService } from './parser.service';
import { PlatformFetchError } from './core/platform-fetch.error';
import { SummarizeRepoDto } from './dto/summarize-repo.dto';
import { GetGithubProfileEndpoint, SummarizeRepoEndpoint } from './swagger/parser.swagger';

@ApiTags('Parser')
@Controller('parser')
export class ParserController {
  constructor(private readonly parserService: ParserService) {}

  @Get('github/:username')
  @UseGuards(JwtAuthGuard)
  @GetGithubProfileEndpoint()
  async getGithubProfile(@Param('username') username: string) {
    try {
      return await this.parserService.github().fetch(username);
    } catch (err) {
      if (err instanceof PlatformFetchError) {
        throw new HttpException(err.message, err.statusCode);
      }
      throw err;
    }
  }

  @Post('github/summarize')
  @UseGuards(JwtAuthGuard)
  @SummarizeRepoEndpoint()
  async summarizeRepo(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SummarizeRepoDto,
  ) {
    const summary = await this.parserService.summarizeRepo(user.sub, dto.repoFullName);
    return { summary };
  }
}
