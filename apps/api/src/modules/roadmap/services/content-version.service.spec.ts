import { NotFoundException } from '@nestjs/common';
import { ContentVersionService } from './content-version.service';

describe('ContentVersionService', () => {
  let service: ContentVersionService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      launchpadContentVersion: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };
    service = new ContentVersionService(prismaMock);
  });

  it('recordVersion computes versionNumber 1 and no previousVersionId for the first row of a node+section', async () => {
    prismaMock.launchpadContentVersion.findFirst.mockResolvedValue(null);
    prismaMock.launchpadContentVersion.create.mockResolvedValue({ id: 'v1' });

    await service.recordVersion({
      nodeId: 'node-1',
      content: { notes: 'hello' },
      source: 'MANUAL',
      status: 'published',
    });

    const call = prismaMock.launchpadContentVersion.create.mock.calls[0][0];
    expect(call.data.versionNumber).toBe(1);
    expect(call.data.previousVersionId).toBeNull();
    expect(call.data.section).toBe('full');
  });

  it('recordVersion increments off the latest existing row and links previousVersionId', async () => {
    prismaMock.launchpadContentVersion.findFirst.mockResolvedValue({
      id: 'v3',
      versionNumber: 3,
    });
    prismaMock.launchpadContentVersion.create.mockResolvedValue({ id: 'v4' });

    await service.recordVersion({
      nodeId: 'node-1',
      content: { notes: 'updated' },
      source: 'AI',
      status: 'draft',
      generationJobId: 'job-9',
      instruction: 'add an example',
    });

    const call = prismaMock.launchpadContentVersion.create.mock.calls[0][0];
    expect(call.data.versionNumber).toBe(4);
    expect(call.data.previousVersionId).toBe('v3');
    expect(call.data.source).toBe('AI');
    expect(call.data.generationJobId).toBe('job-9');
    expect(call.data.instruction).toBe('add an example');
  });

  it('recordVersion sets reviewedAt only when a reviewerId is supplied', async () => {
    prismaMock.launchpadContentVersion.findFirst.mockResolvedValue(null);
    prismaMock.launchpadContentVersion.create.mockResolvedValue({});

    await service.recordVersion({
      nodeId: 'node-1',
      content: {},
      source: 'MANUAL',
      status: 'published',
    });
    expect(
      prismaMock.launchpadContentVersion.create.mock.calls[0][0].data
        .reviewedAt,
    ).toBeNull();

    await service.recordVersion({
      nodeId: 'node-1',
      content: {},
      source: 'MANUAL',
      status: 'published',
      reviewerId: 'admin-1',
    });
    expect(
      prismaMock.launchpadContentVersion.create.mock.calls[1][0].data
        .reviewedAt,
    ).toBeInstanceOf(Date);
  });

  it('recordVersion tracks section independently — a "quiz" row does not affect "full"\'s version counter', async () => {
    prismaMock.launchpadContentVersion.findFirst.mockImplementation(
      ({ where }: any) =>
        where.section === 'full' ? { id: 'full-2', versionNumber: 2 } : null,
    );
    prismaMock.launchpadContentVersion.create.mockResolvedValue({});

    await service.recordVersion({
      nodeId: 'node-1',
      section: 'quiz',
      content: {},
      source: 'AI',
      status: 'draft',
    });

    const call = prismaMock.launchpadContentVersion.create.mock.calls[0][0];
    expect(call.data.section).toBe('quiz');
    expect(call.data.versionNumber).toBe(1); // quiz has no prior rows, independent of "full" already being at 2
  });

  it('getVersion throws NotFoundException when the version belongs to a different node', async () => {
    prismaMock.launchpadContentVersion.findFirst.mockResolvedValue(null);
    await expect(
      service.getVersion('node-1', 'v-from-another-node'),
    ).rejects.toThrow(NotFoundException);
  });

  it('listVersions queries by nodeId + section and does not leak other sections', async () => {
    prismaMock.launchpadContentVersion.findMany.mockResolvedValue([]);
    await service.listVersions('node-1');
    expect(prismaMock.launchpadContentVersion.findMany).toHaveBeenCalledWith({
      where: { nodeId: 'node-1', section: 'full' },
      orderBy: { versionNumber: 'desc' },
    });
  });
});
