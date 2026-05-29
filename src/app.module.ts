import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MongooseDatabaseModule } from './shared/mongoose/mongoose.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { ParserModule } from './parser/parser.module';

@Module({
  imports: [
    // ─── Config ─────────────────────────────────────────────────────────
    // isGlobal: true makes ConfigService available everywhere without
    // re-importing ConfigModule in every feature module.
    ConfigModule.forRoot({ isGlobal: true }),

    // ─── Database ────────────────────────────────────────────────────────
    MongooseDatabaseModule,

    // ─── Feature modules ─────────────────────────────────────────────────
    AuthModule,
    ProfileModule,
    ParserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
