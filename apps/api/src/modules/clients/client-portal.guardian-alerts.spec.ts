import { ClientPortalService } from './client-portal.service';

function build(opts: { planAllows?: boolean } = {}) {
  const prefs = new Map<string, any>();
  const prisma: any = {
    guardianClientNotificationPreference: {
      findUnique: jest.fn(
        async ({ where }: any) => prefs.get(where.clientId) ?? null,
      ),
      upsert: jest.fn(async ({ where, create, update }: any) =>
        prefs.set(where.clientId, {
          ...(prefs.get(where.clientId) ?? create),
          ...update,
        }),
      ),
    },
    guardianAgent: {
      findMany: jest.fn().mockResolvedValue([
        {
          server: {
            id: 'vm1',
            name: 'client-vm',
            metadata: {
              backup: {
                lastSuccessAt: new Date().toISOString(),
                snapshots: [
                  { id: 'abcdef1234567890zzz', time: '2026-09-25T02:40:00Z' },
                ],
                lastDrill: {
                  ok: true,
                  at: '2026-09-21T05:10:00Z',
                  restoredFiles: 350,
                },
                paths: ['/secret/path'],
              },
            },
          },
        },
      ]),
    },
    asset: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.id === 'vm1' && where.clientId === 'c1'
          ? { id: 'vm1', name: 'client-vm' }
          : null,
      ),
    },
    ticket: {
      create: jest.fn(async ({ data }: any) => ({ id: 't1', ...data })),
    },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin1' }]) },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };
  const plans: any = {
    clientAllows: jest.fn().mockResolvedValue(opts.planAllows ?? true),
  };
  const webPush: any = {
    enabled: true,
    publicKey: 'PUB',
    countClient: jest.fn().mockResolvedValue(2),
    subscribeClient: jest.fn().mockResolvedValue({ subscribed: true }),
    sendToClient: jest.fn().mockResolvedValue(1),
  };
  const telegram: any = {
    enabled: true,
    send: jest.fn().mockResolvedValue(true),
  };
  const svc = new ClientPortalService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    undefined,
    plans,
    webPush,
    telegram,
  );
  return { svc, prisma, webPush, telegram };
}

describe('client portal — Guardian alert channels', () => {
  it("defaults to email on and saves validated choices for the caller's client only", async () => {
    const { svc, prisma } = build();
    expect(await svc.getClientNotificationPreferences('c1')).toMatchObject({
      emailEnabled: true,
      pushEnabled: true,
      telegramChatId: null,
      pushAvailable: true,
      pushDevices: 2,
    });
    const r = await svc.updateClientNotificationPreferences('c1', {
      emailEnabled: false,
      telegramChatId: ' 12345 ',
    });
    expect(r).toMatchObject({ emailEnabled: false, telegramChatId: '12345' });
    expect(
      prisma.guardianClientNotificationPreference.upsert.mock.calls[0][0].where,
    ).toEqual({ clientId: 'c1' });
    await expect(
      svc.updateClientNotificationPreferences('c1', {
        telegramChatId: 'not-a-number',
      }),
    ).rejects.toThrow(/numeric/);
  });

  it('tests Telegram only with a saved chat id', async () => {
    const { svc, telegram } = build();
    await expect(svc.testClientTelegram('c1')).rejects.toThrow(/chat id/);
    await svc.updateClientNotificationPreferences('c1', {
      telegramChatId: '777',
    });
    expect(await svc.testClientTelegram('c1')).toEqual({ ok: true });
    expect(telegram.send).toHaveBeenCalledWith('777', expect.any(String));
  });
});

describe('client portal — backups and restore requests', () => {
  it('shows backup state without internal details', async () => {
    const { svc } = build();
    const r: any = await svc.getClientBackups('c1');
    expect(r.available).toBe(true);
    expect(r.servers[0]).toMatchObject({
      name: 'client-vm',
      protected: true,
      snapshotCount: 1,
      lastRestoreTest: { ok: true },
    });
    expect(r.servers[0].snapshots[0].id).toHaveLength(16);
    expect(JSON.stringify(r)).not.toContain('/secret/path');
  });

  it('is an Enterprise feature', async () => {
    const { svc } = build({ planAllows: false });
    expect(await svc.getClientBackups('c1')).toMatchObject({
      available: false,
    });
    await expect(
      svc.requestClientRestore('c1', 'vm1', { path: '/var/www/site' }),
    ).rejects.toThrow(/Enterprise/);
  });

  it('opens a ticket and notifies admins; never restores directly; validates input and ownership', async () => {
    const { svc, prisma } = build();
    const r = await svc.requestClientRestore('c1', 'vm1', {
      snapshot: 'latest',
      path: '/var/www/site',
      note: 'deleted by mistake',
    });
    expect(r).toEqual({ ticketId: 't1', status: 'REQUESTED' });
    const t = prisma.ticket.create.mock.calls[0][0].data;
    expect(t).toMatchObject({
      clientId: 'c1',
      priority: 'HIGH',
      category: 'GUARDIAN_RESTORE',
    });
    expect(t.description).toContain('deleted by mistake');
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'admin1',
          link: '/guardian/backups',
        }),
      }),
    );
    await expect(
      svc.requestClientRestore('c1', 'vm1', { path: '/var/www/../../etc' }),
    ).rejects.toThrow(/absolute path/);
    await expect(
      svc.requestClientRestore('c1', 'vm1', {
        snapshot: 'latest; rm',
        path: '/var/www',
      }),
    ).rejects.toThrow(/Snapshot/);
    await expect(
      svc.requestClientRestore('c2', 'vm1', { path: '/var/www/site' }),
    ).rejects.toThrow(/not found/);
  });
});
