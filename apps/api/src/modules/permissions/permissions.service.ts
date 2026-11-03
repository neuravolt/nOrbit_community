import { Injectable } from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';
import { PermissionGroupDto } from './dto/permission.dto';
import { PERMISSION_MATRIX } from './permission-matrix';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  async seedDefaultPermissions(): Promise<void> {
    await this.permissionsRepository.createMany(PERMISSION_MATRIX);
  }

  async listPermissions(): Promise<PermissionGroupDto[]> {
    const permissions = await this.permissionsRepository.findAll();

    const grouped = permissions.reduce((acc, permission) => {
      const existing = acc.find((g) => g.resource === permission.resource);
      if (existing) {
        existing.permissions.push(permission);
      } else {
        acc.push({
          resource: permission.resource,
          permissions: [permission],
        });
      }
      return acc;
    }, [] as PermissionGroupDto[]);

    return grouped;
  }
}
