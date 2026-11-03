import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TasksRepository } from './tasks.repository';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { GuardianModule } from '../guardian/guardian.module';

@Module({
  imports: [PrismaModule, GuardianModule],
  controllers: [TasksController],
  providers: [TasksService, TasksRepository],
  exports: [TasksService, TasksRepository],
})
export class TasksModule {}
