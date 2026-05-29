import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  // AuthModule exports USER_REPOSITORY, which ProfileService injects.
  // No separate User schema registration is needed here.
  imports: [AuthModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
