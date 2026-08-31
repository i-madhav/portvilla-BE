import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { ENV_FILE_PATHS } from './shared/configuration/env-files.config';
import { HttpLoggerMiddleware } from './shared/logging/http-logger.middleware';
import { MongooseDatabaseModule } from './shared/mongoose/mongoose.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProfileModule } from './profile/profile.module';
import { ParserModule } from './parser/parser.module';
import { SessionModule } from './session/session.module';
import { AgentModule } from './agent/agent.module';

@Module({
  imports: [
    // ─── Config ─────────────────────────────────────────────────────────
    // isGlobal: true makes ConfigService available everywhere without
    // re-importing ConfigModule in every feature module.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATHS,
    }),

    // ─── Rate limiting ───────────────────────────────────────────────────
    // Generous global default; sensitive public routes tighten it per-handler

    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // ─── Database ────────────────────────────────────────────────────────
    MongooseDatabaseModule,

    // ─── Feature modules ─────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    ProfileModule,
    ParserModule,
    SessionModule,
    AgentModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  // Register the HTTP request logger for every route so each API call is traced.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
