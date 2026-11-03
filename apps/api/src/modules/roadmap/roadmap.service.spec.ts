import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RoadmapService } from './roadmap.service';

// Phase 1B, scenario C: students must never be able to read a node's draftContent. The tree
// endpoint is the one student-facing query that touches LaunchpadRoadmapNode rows directly, so
// this locks in the explicit `select` (added for Phase 1B) that keeps draftContent — and other
// non-public fields — off the wire, rather than relying on a bare Prisma `include`.
describe('RoadmapService — Phase 1B student-facing draft isolation', () => {
  let service: RoadmapService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      launchpadTechnology: { findUnique: jest.fn() },
      launchpadStudentTechnologyProgress: { findUnique: jest.fn() },
      launchpadStudentNodeProgress: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoadmapService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<RoadmapService>(RoadmapService);
  });

  it('C: getTechnologyTree selects an explicit field list for nodes that excludes draftContent', async () => {
    prismaMock.launchpadTechnology.findUnique.mockResolvedValue({
      id: 'tech-1',
      name: 'Tech',
      description: '',
      icon: '',
      levels: [],
    });
    prismaMock.launchpadStudentTechnologyProgress.findUnique.mockResolvedValue(
      null,
    );
    prismaMock.launchpadStudentNodeProgress.findMany.mockResolvedValue([]);

    await service.getTechnologyTree('tech-1', 'student-1');

    const call = prismaMock.launchpadTechnology.findUnique.mock.calls[0][0];
    const nodesClause = call.include.levels.include.nodes;

    // Must be a `select`, not a bare `include` — a bare include would return every column,
    // including the new draftContent field.
    expect(nodesClause.select).toBeDefined();
    expect(nodesClause.include).toBeUndefined();
    expect(nodesClause.select.draftContent).toBeUndefined();
    expect(Object.keys(nodesClause.select).sort()).toEqual([
      'id',
      'nodeNumber',
      'status',
      'title',
    ]);
  });
});
