import { Module, OnModuleInit } from '@nestjs/common';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { PermissionsRepository } from './permissions.repository';
import { PrismaModule } from '../../common';

@Module({
  imports: [PrismaModule],
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionsRepository],
  exports: [PermissionsService, PermissionsRepository],
})
export class PermissionsModule implements OnModuleInit {
  constructor(private permissionsService: PermissionsService) {}

  async onModuleInit() {
    // Seed default permissions on bootstrap
    await this.permissionsService.seedDefaultPermissions();
  }
}
