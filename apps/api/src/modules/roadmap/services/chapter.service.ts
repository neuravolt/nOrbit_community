import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface CreateChapterInput {
  sortOrder?: number;
  title: string;
  description?: string;
  objectivesSummary?: unknown;
  status?: string;
}

export interface UpdateChapterInput {
  sortOrder?: number;
  title?: string;
  description?: string;
  objectivesSummary?: unknown;
  status?: string;
}

/**
 * Launchpad Phase 5B, Slice 5B-2. Minimal CRUD over LaunchpadChapter — this slice's own scope
 * is the data foundation and the backfill, not an admin API surface (no controller/routes are
 * added in this slice; the plan's Phase 6 slices, which actually generate chapters via the
 * staged pipeline, are what will call these methods next). Kept intentionally small rather than
 * building out a full admin CRUD surface no caller needs yet.
 */
@Injectable()
export class ChapterService {
  constructor(private prisma: PrismaService) {}

  // _count.topics lets the admin Syllabus UI show "N topics" per chapter without a second
  // round-trip per chapter.
  async findByLevel(technologyLevelId: string) {
    return this.prisma.launchpadChapter.findMany({
      where: { technologyLevelId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { topics: true } } },
    });
  }

  async findOne(id: string) {
    const chapter = await this.prisma.launchpadChapter.findUnique({
      where: { id },
    });
    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }
    return chapter;
  }

  async create(technologyLevelId: string, dto: CreateChapterInput) {
    return this.prisma.launchpadChapter.create({
      data: {
        technologyLevelId,
        title: dto.title,
        description: dto.description,
        objectivesSummary: dto.objectivesSummary as any,
        sortOrder: dto.sortOrder ?? 1,
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async update(id: string, dto: UpdateChapterInput) {
    return this.prisma.launchpadChapter.update({
      where: { id },
      data: dto as any,
    });
  }
}
