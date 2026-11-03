import { NotFoundException } from '@nestjs/common';
import { ChapterService } from './chapter.service';

describe('ChapterService', () => {
  let service: ChapterService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      launchpadChapter: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new ChapterService(prismaMock);
  });

  it('findByLevel orders by sortOrder ascending, scoped to the given level, with a topic count', async () => {
    prismaMock.launchpadChapter.findMany.mockResolvedValue([]);
    await service.findByLevel('level-1');
    expect(prismaMock.launchpadChapter.findMany).toHaveBeenCalledWith({
      where: { technologyLevelId: 'level-1' },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { topics: true } } },
    });
  });

  it('findOne throws NotFoundException for a missing chapter', async () => {
    prismaMock.launchpadChapter.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('create defaults sortOrder to 1 when not supplied', async () => {
    prismaMock.launchpadChapter.create.mockResolvedValue({});
    await service.create('level-1', { title: 'Async Foundations' });
    expect(prismaMock.launchpadChapter.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        technologyLevelId: 'level-1',
        title: 'Async Foundations',
        sortOrder: 1,
      }),
    });
  });
});
