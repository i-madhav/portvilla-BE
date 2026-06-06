import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ParserController } from './parser.controller';
import { ParserService } from './parser.service';
import { LlmModule } from '../llm/llm.module';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [ConfigModule, LlmModule, ProfileModule],
  controllers: [ParserController],
  providers: [ParserService],
})
export class ParserModule {}
