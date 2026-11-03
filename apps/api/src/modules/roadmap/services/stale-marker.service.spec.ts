import { StaleMarkerService } from './stale-marker.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('StaleMarkerService', () => {
  let markerStore: any[];
  let prismaMock: any;
  let service: StaleMarkerService;

  beforeEach(() => {
    markerStore = [];
    prismaMock = {
      launchpadStaleMarker: {
        findFirst: jest.fn(
          async ({ where }: any) =>
            markerStore.find(
              (m) =>
                m.entityType === where.entityType &&
                m.entityId === where.entityId &&
                m.resolvedAt === null,
            ) ?? null,
        ),
        findMany: jest.fn(async ({ where }: any) =>
          markerStore.filter(
            (m) =>
              m.entityType === where.entityType &&
              m.entityId === where.entityId &&
              m.resolvedAt === null,
          ),
        ),
        findUnique: jest.fn(
          async ({ where }: any) =>
            markerStore.find((m) => m.id === where.id) ?? null,
        ),
        create: jest.fn(async ({ data }: any) => {
          const row = {
            id: `marker-${markerStore.length + 1}`,
            resolvedAt: null,
            professorDecision: null,
            staleSince: new Date(),
            createdAt: new Date(),
            ...data,
          };
          markerStore.push(row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const row = markerStore.find((m) => m.id === where.id);
          Object.assign(row, data);
          return row;
        }),
      },
    };
    service = new StaleMarkerService(prismaMock);
  });

  it('markStale inserts one row for a new entity', async () => {
    const marker = await service.markStale('quiz', 'node-1', 'version-1');
    expect(marker.entityType).toBe('quiz');
    expect(marker.entityId).toBe('node-1');
    expect(marker.triggeredByVersionId).toBe('version-1');
    expect(markerStore).toHaveLength(1);
  });

  it('markStale is a no-op (returns the existing row) when an unresolved marker already exists for the same entity', async () => {
    const first = await service.markStale('quiz', 'node-1', 'version-1');
    const second = await service.markStale('quiz', 'node-1', 'version-2');
    expect(second.id).toBe(first.id);
    expect(markerStore).toHaveLength(1); // no pile-up
  });

  it('markStale inserts a new row again once the previous marker for that entity was resolved', async () => {
    const first = await service.markStale('quiz', 'node-1', 'version-1');
    await service.resolve(first.id, 'KEEP');
    const second = await service.markStale('quiz', 'node-1', 'version-2');
    expect(second.id).not.toBe(first.id);
    expect(markerStore).toHaveLength(2);
  });

  it('listUnresolved only returns markers with no resolvedAt', async () => {
    const a = await service.markStale('quiz', 'node-1', 'version-1');
    await service.resolve(a.id, 'REGENERATE');
    await service.markStale('challenge', 'node-1', 'version-1');

    const unresolvedQuiz = await service.listUnresolved('quiz', 'node-1');
    const unresolvedChallenge = await service.listUnresolved(
      'challenge',
      'node-1',
    );
    expect(unresolvedQuiz).toHaveLength(0);
    expect(unresolvedChallenge).toHaveLength(1);
  });

  it('resolve sets resolvedAt and professorDecision', async () => {
    const marker = await service.markStale('quiz', 'node-1', 'version-1');
    const resolved = await service.resolve(marker.id, 'EDIT_MANUALLY');
    expect(resolved.resolvedAt).toBeInstanceOf(Date);
    expect(resolved.professorDecision).toBe('EDIT_MANUALLY');
  });

  it('resolve rejects a decision outside REGENERATE/KEEP/EDIT_MANUALLY', async () => {
    const marker = await service.markStale('quiz', 'node-1', 'version-1');
    await expect(
      service.resolve(marker.id, 'DELETE_EVERYTHING'),
    ).rejects.toThrow(BadRequestException);
  });

  it('resolve on a nonexistent marker throws NotFoundException', async () => {
    await expect(service.resolve('no-such-marker', 'KEEP')).rejects.toThrow(
      NotFoundException,
    );
  });
});
