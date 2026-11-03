import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common';

@Injectable()
export class PermissionsRepository {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }, { scope: 'asc' }],
    });
  }

  async findById(id: string) {
    return this.prisma.permission.findUnique({
      where: { id },
    });
  }

  async findByResourceActionScope(
    resource: string,
    action: string,
    scope: string,
  ) {
    return this.prisma.permission.findUnique({
      where: {
        resource_action_scope: {
          resource,
          action,
          scope,
        },
      },
    });
  }

  async createMany(
    permissions: Array<{ resource: string; action: string; scope: string }>,
  ) {
    return this.prisma.permission.createMany({
      data: permissions,
      skipDuplicates: true,
    });
  }
}
