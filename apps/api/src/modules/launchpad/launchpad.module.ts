import { Module } from '@nestjs/common';
import { LaunchpadEventBus } from './services/launchpad-event-bus';
import { StudentJwtAuthGuard } from './guards/student-auth.guard';

@Module({
  providers: [LaunchpadEventBus, StudentJwtAuthGuard],
  exports: [LaunchpadEventBus, StudentJwtAuthGuard],
})
export class LaunchpadModule {}
