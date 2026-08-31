import { Module } from '@nestjs/common';

import { ProfileModule } from '../profile/profile.module';

import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { ServiceTokenGuard } from './guards/service-token.guard';

/**
 * The backend half of the BE↔worker contract.
 *
 * No repository and no schema of its own: the agent context is a projection of
 * a profile, so this module reads through `PROFILE_REPOSITORY` (exported by
 * ProfileModule) and derives the catalog with the pure projector. Nothing here
 * owns state.
 */
@Module({
  imports: [ProfileModule],
  controllers: [AgentController],
  providers: [AgentService, ServiceTokenGuard],
})
export class AgentModule {}
