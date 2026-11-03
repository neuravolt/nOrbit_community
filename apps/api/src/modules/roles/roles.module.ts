import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { RolesRepository } from './roles.repository';
import { PermissionsGuard } from './guards/permissions.guard';
import { PrismaModule } from '../../common';

@Module({
  imports: [PrismaModule],
  controllers: [RolesController],
  providers: [RolesService, RolesRepository, PermissionsGuard],
  exports: [RolesService, RolesRepository, PermissionsGuard],
})
export class RolesModule {}
