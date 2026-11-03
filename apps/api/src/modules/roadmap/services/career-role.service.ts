import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  CreateCareerRoleDto,
  UpdateCareerRoleDto,
} from '../dto/career-role.dto';

@Injectable()
export class CareerRoleService {
  constructor(private prisma: PrismaService) {}

  async findByCareer(careerId: string) {
    return this.prisma.launchpadCareerRole.findMany({
      where: { careerId, isActive: true },
      include: { career: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(careerId: string, dto: CreateCareerRoleDto) {
    const careerExists = await this.prisma.launchpadCareer.findUnique({
      where: { id: careerId },
    });
    if (!careerExists) {
      throw new NotFoundException('Career not found');
    }

    return this.prisma.launchpadCareerRole.create({
      data: {
        ...dto,
        careerId,
      },
    });
  }

  async update(id: string, dto: UpdateCareerRoleDto) {
    return this.prisma.launchpadCareerRole.update({
      where: { id },
      data: dto,
    });
  }

  async softDelete(id: string) {
    return this.prisma.launchpadCareerRole.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
