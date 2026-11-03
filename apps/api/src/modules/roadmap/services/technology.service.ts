import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  CreateTechnologyDto,
  UpdateTechnologyDto,
} from '../dto/technology.dto';
// Plain constant import, not a DI-managed provider — safe across modules without any
// RoadmapModule <-> VerificationEngineModule wiring (same reasoning already used for
// substituteParams in roadmap.service.ts). Confirms whether this Technology's slug has a
// registered PatternConfig/TechnologyAdapter (verification-engine/validators/technology-
// adapter.ts) — the same lookup verification-engine.service.ts itself now throws on when
// missing (the "Unknown-technology hardening" fix). Surfacing it here, at Technology
// create/list/detail time, means an admin sees the gap immediately instead of only discovering
// it when a real student's submission fails to verify.
const VERIFICATION_ENGINE_FRAMEWORKS = new Set<string>();

@Injectable()
export class TechnologyService {
  constructor(private prisma: PrismaService) {}

  private withVerificationStatus<T extends { slug: string }>(
    technology: T,
  ): T & { verificationConfigured: boolean } {
    return {
      ...technology,
      verificationConfigured: technology.slug in VERIFICATION_ENGINE_FRAMEWORKS,
    };
  }

  async findByRole(careerRoleId: string) {
    const rows = await this.prisma.launchpadTechnology.findMany({
      where: { careerRoleId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((r: any) => this.withVerificationStatus(r));
  }

  async findOne(id: string) {
    const record = await this.prisma.launchpadTechnology.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException('Technology not found');
    }
    return this.withVerificationStatus(record as any);
  }

  async create(careerRoleId: string, dto: CreateTechnologyDto) {
    const roleExists = await this.prisma.launchpadCareerRole.findUnique({
      where: { id: careerRoleId },
    });
    if (!roleExists) {
      throw new NotFoundException('CareerRole not found');
    }

    if (dto.defaultStack) {
      await this.unsetPreviousDefault(careerRoleId);
    }

    const created = await this.prisma.launchpadTechnology.create({
      data: {
        ...dto,
        careerRoleId,
      },
    });
    return this.withVerificationStatus(created as any);
  }

  async update(id: string, dto: UpdateTechnologyDto) {
    const record = await this.prisma.launchpadTechnology.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException('Technology not found');
    }

    if (dto.defaultStack) {
      await this.unsetPreviousDefault(record.careerRoleId);
    }

    return this.prisma.launchpadTechnology.update({
      where: { id },
      data: dto,
    });
  }

  async softDelete(id: string) {
    return this.prisma.launchpadTechnology.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async setDefaultStack(id: string) {
    const record = await this.prisma.launchpadTechnology.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException('Technology not found');
    }

    await this.unsetPreviousDefault(record.careerRoleId);

    return this.prisma.launchpadTechnology.update({
      where: { id },
      data: { defaultStack: true },
    });
  }

  private async unsetPreviousDefault(careerRoleId: string) {
    await this.prisma.launchpadTechnology.updateMany({
      where: { careerRoleId, defaultStack: true },
      data: { defaultStack: false },
    });
  }
}
