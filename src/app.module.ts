import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ParserModule } from './parser/parser.module';

@Module({
  imports: [
    // ─── Config ─────────────────────────────────────────────────────────
    // isGlobal: true makes ConfigService available everywhere without
    // re-importing ConfigModule in every feature module.
    ConfigModule.forRoot({ isGlobal: true }),

    // ─── Database ────────────────────────────────────────────────────────
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),

    // ─── Feature modules ─────────────────────────────────────────────────
    AuthModule,
    ParserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
