import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQuery } from './dto/list-users.query';

@Injectable()
export class UsersRepository {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        userRoles: {
          select: {
            roleId: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        userRoles: {
          select: {
            roleId: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(data: CreateUserDto & { passwordHash: string }) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        isActive: true,
        userRoles: data.roleId
          ? {
              create: {
                roleId: data.roleId,
              },
            }
          : undefined,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        userRoles: {
          select: {
            roleId: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAll(query: ListUsersQuery) {
    const { page = 1, limit = 20, status, search } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { deletedAt: null };

    if (status) {
      where.isActive = status === 'ACTIVE';
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          userRoles: {
            select: {
              roleId: true,
            },
          },
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      limit,
    };
  }

  async update(id: string, data: UpdateUserDto & { passwordHash?: string }) {
    const updateData: any = {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      isActive: data.status
        ? data.status === 'INACTIVE'
          ? false
          : true
        : undefined,
    };

    if (data.passwordHash) {
      updateData.passwordHash = data.passwordHash;
    }

    if (data.roleId) {
      updateData.userRoles = {
        deleteMany: {},
        create: {
          roleId: data.roleId,
        },
      };
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        userRoles: {
          select: {
            roleId: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async softDelete(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  async restore(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findIdWithoutDeleted(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
  }
}
