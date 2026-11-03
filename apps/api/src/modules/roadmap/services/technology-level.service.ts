import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  CreateTechnologyLevelDto,
  UpdateTechnologyLevelDto,
} from '../dto/technology-level.dto';

@Injectable()
export class TechnologyLevelService {
  constructor(private prisma: PrismaService) {}

  async findByTech(technologyId: string) {
    return this.prisma.launchpadTechnologyLevel.findMany({
      where: { technologyId, isActive: true },
      orderBy: { levelNumber: 'asc' },
    });
  }

  async findOne(id: string) {
    const record = await this.prisma.launchpadTechnologyLevel.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException('TechnologyLevel not found');
    }
    return record;
  }

  async create(technologyId: string, dto: CreateTechnologyLevelDto) {
    const techExists = await this.prisma.launchpadTechnology.findUnique({
      where: { id: technologyId },
    });
    if (!techExists) {
      throw new NotFoundException('Technology not found');
    }

    let levelNumber = dto.levelNumber;
    if (!levelNumber) {
      const lastLevel = await this.prisma.launchpadTechnologyLevel.findFirst({
        where: { technologyId },
        orderBy: { levelNumber: 'desc' },
      });
      levelNumber = lastLevel ? lastLevel.levelNumber + 1 : 1;
    }

    return this.prisma.launchpadTechnologyLevel.create({
      data: {
        ...dto,
        // LaunchpadTechnologyLevel.name is required — legacy allowed it empty, so fall back
        // to the same "Level N" label the frontend already displays when name is blank.
        name: dto.name || `Level ${levelNumber}`,
        technologyId,
        levelNumber,
      },
    });
  }

  async update(id: string, dto: UpdateTechnologyLevelDto) {
    return this.prisma.launchpadTechnologyLevel.update({
      where: { id },
      data: dto,
    });
  }

  async softDelete(id: string) {
    return this.prisma.launchpadTechnologyLevel.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
