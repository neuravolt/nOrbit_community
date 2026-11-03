import { trackSprayFailure, sprayBucket } from './credential-spray';

function fakeRedis() {
  const sets = new Map<string, Set<string>>();
  const kv = new Map<string, string>();
  return {
    pfadd: jest.fn(async (k: string, v: string) => {
      const s = sets.get(k) || new Set();
      s.add(v);
      sets.set(k, s);
      return 1;
    }),
    pfcount: jest.fn(async (k: string) => sets.get(k)?.size ?? 0),
    expire: jest.fn(async () => 1),
    set: jest.fn(async (k: string, v: string, ...args: any[]) => {
      if (args.includes('NX') && kv.has(k)) return null;
      kv.set(k, v);
      return 'OK';
    }),
  };
}

describe('credential spray detection', () => {
  const prisma: any = {
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'sa1' }]) },
    notification: { create: jest.fn() },
  };
  beforeEach(() => {
    prisma.notification.create.mockClear();
    delete process.env.LOGIN_SPRAY_THRESHOLD;
  });

  it('alerts once when many distinct accounts fail in one window, not for one account failing often', async () => {
    const redis = fakeRedis();
    const t = 1_790_000_000_000;
    for (let i = 0; i < 50; i++)
      await trackSprayFailure(redis, prisma, 'user', 'same@x.io', t);
    expect(prisma.notification.create).not.toHaveBeenCalled();
    const fired: boolean[] = [];
    for (let i = 0; i < 40; i++)
      fired.push(
        await trackSprayFailure(redis, prisma, 'user', `u${i}@x.io`, t),
      );
    expect(fired.filter(Boolean)).toHaveLength(1);
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create.mock.calls[0][0].data.title).toContain(
      'credential-stuffing',
    );
  });

  it('uses 10-minute windows and a configurable threshold (min 5)', async () => {
    expect(sprayBucket(600_000)).toBe(1);
    process.env.LOGIN_SPRAY_THRESHOLD = '2';
    const redis = fakeRedis();
    for (let i = 0; i < 4; i++)
      await trackSprayFailure(redis, prisma, 'client', `c${i}`, 0);
    expect(prisma.notification.create).not.toHaveBeenCalled();
    await trackSprayFailure(redis, prisma, 'client', 'c5', 0);
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
  });

  it('never throws when Redis is down', async () => {
    const broken: any = {
      pfadd: jest.fn().mockRejectedValue(new Error('down')),
      pfcount: jest.fn(),
      expire: jest.fn(),
      set: jest.fn(),
    };
    await expect(
      trackSprayFailure(broken, prisma, 'user', 'a', 0),
    ).resolves.toBe(false);
  });
});
