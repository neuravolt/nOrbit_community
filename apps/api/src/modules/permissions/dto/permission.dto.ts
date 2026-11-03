export class PermissionDto {
  id: string;
  resource: string;
  action: string;
  scope: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PermissionGroupDto {
  resource: string;
  permissions: PermissionDto[];
}
