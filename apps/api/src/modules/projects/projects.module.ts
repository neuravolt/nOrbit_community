import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectsRepository } from './projects.repository';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { GithubModule } from '../github/github.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [PrismaModule, GithubModule, TasksModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectsRepository],
  exports: [ProjectsService, ProjectsRepository],
})
export class ProjectsModule {}
