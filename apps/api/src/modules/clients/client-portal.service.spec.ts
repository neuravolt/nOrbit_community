import { ClientPortalService } from './client-portal.service';

// SENIOR-ENGINEER FIX regression test: getAssets() used to have zero caching and fanned out one
// guardianMonitor query per asset on every single call, with no limit on concurrent invocations.
// Confirmed live this session: the API process repeatedly ballooned from ~250MB to 10-14GB within
// seconds under this exact pattern — multiple uncached, unbounded-concurrency fan-out calls piling
// up (multiple tabs, retries, a slow client) drove real memory pressure and swap thrashing. Fixed
// with a short Redis cache + in-flight promise de-dup, mirroring GuardianService.getDashboardOverview's
// already-proven pattern. These tests prove the fan-out only actually runs once per cache window,
// even under concurrent calls, instead of once per call.
describe('ClientPortalService.getAssets — cache + in-flight de-dup', () => {
  let service: ClientPortalService;
  let prismaMock: any;
  let redisStore: Map<string, string>;

  beforeEach(() => {
    redisStore = new Map();
    prismaMock = {
      asset: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new ClientPortalService(
      prismaMock,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    (service as any).redis.disconnect();
    (service as any).redis = {
      get: jest.fn(async (key: string) => redisStore.get(key) ?? null),
      setex: jest.fn(async (key: string, _ttl: number, value: string) => {
        redisStore.set(key, value);
      }),
    };
  });

  it('only fans out the expensive per-asset query once for concurrent calls before the cache populates', async () => {
    const results = await Promise.all([
      service.getAssets('client-1'),
      service.getAssets('client-1'),
      service.getAssets('client-1'),
    ]);

    expect(prismaMock.asset.findMany).toHaveBeenCalledTimes(1);
    expect(results).toEqual([[], [], []]);
  });

  it('serves subsequent calls from cache without re-running the fan-out', async () => {
    await service.getAssets('client-1');
    expect(prismaMock.asset.findMany).toHaveBeenCalledTimes(1);

    await service.getAssets('client-1');
    expect(prismaMock.asset.findMany).toHaveBeenCalledTimes(1);
  });

  it('does not share cache/in-flight state across different clients', async () => {
    await Promise.all([
      service.getAssets('client-1'),
      service.getAssets('client-2'),
    ]);

    expect(prismaMock.asset.findMany).toHaveBeenCalledTimes(2);
  });
});
