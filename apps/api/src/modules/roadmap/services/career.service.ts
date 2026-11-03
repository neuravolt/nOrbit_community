import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateCareerDto, UpdateCareerDto } from '../dto/career.dto';

@Injectable()
export class CareerService {
  constructor(private prisma: PrismaService) {}

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.launchpadCareer.findMany({
        where: { isActive: true },
        skip,
        take: limit,
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.launchpadCareer.count({ where: { isActive: true } }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(dto: CreateCareerDto) {
    return this.prisma.launchpadCareer.create({
      data: dto,
    });
  }

  async update(id: string, dto: UpdateCareerDto) {
    return this.prisma.launchpadCareer.update({
      where: { id },
      data: dto,
    });
  }

  async softDelete(id: string) {
    return this.prisma.launchpadCareer.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
