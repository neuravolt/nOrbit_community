import { PermissionDto } from '../../permissions/dto/permission.dto';

export class RoleDto {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: PermissionDto[];
  createdAt: Date;
  updatedAt: Date;
}

export class RoleListDto {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissionCount: number;
  permissions?: PermissionDto[];
  createdAt: Date;
  updatedAt: Date;
}
