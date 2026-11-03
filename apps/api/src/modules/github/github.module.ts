import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GithubController } from './controllers/github.controller';
import { GithubAdminController } from './controllers/github-admin.controller';
import { ProjectGithubWebhookController } from './controllers/project-github-webhook.controller';
import { GithubSettingsController } from './controllers/github-settings.controller';
import { GithubService } from './services/github.service';
import { ProjectGithubSyncService } from './services/project-github-sync.service';
import { LaunchpadModule } from '../launchpad/launchpad.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [
    forwardRef(() => LaunchpadModule),
    JwtModule.register({}),
    TasksModule,
  ],
  controllers: [
    GithubController,
    GithubAdminController,
    ProjectGithubWebhookController,
    GithubSettingsController,
  ],
  providers: [GithubService, ProjectGithubSyncService],
  exports: [GithubService, ProjectGithubSyncService],
})
export class GithubModule {}
