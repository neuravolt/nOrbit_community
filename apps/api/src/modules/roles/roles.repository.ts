import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesRepository {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async findByName(name: string) {
    return this.prisma.role.findUnique({
      where: { name },
    });
  }

  async create(data: CreateRoleDto) {
    return this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        isSystem: false,
        permissions: {
          create: data.permissionIds.map((permissionId) => ({
            permissionId,
          })),
        },
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateRoleDto) {
    // Delete existing permissions if updating
    if (data.permissionIds) {
      await this.prisma.rolePermission.deleteMany({
        where: { roleId: id },
      });
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        permissions: data.permissionIds
          ? {
              create: data.permissionIds.map((permissionId) => ({
                permissionId,
              })),
            }
          : undefined,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    return this.prisma.role.delete({
      where: { id },
    });
  }

  async hasUsers(roleId: string): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: { roleId },
    });
    return count > 0;
  }
}
