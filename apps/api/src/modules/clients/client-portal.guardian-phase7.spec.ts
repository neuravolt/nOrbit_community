import { ClientPortalService } from './client-portal.service';

describe('ClientPortalService — Guardian expiries & findings (client isolation)', () => {
  const prisma: any = {
    securityFinding: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'f1',
          severity: 'WARNING',
          findingType: 'SPF_MISSING',
          evidence: {
            title: 'No SPF',
            detail: 'd',
            fix: 'x',
            secret: 'never-shown',
          },
          detectedAt: new Date(),
          asset: { id: 'a1', name: 'acme.com' },
        },
        {
          id: 'f2',
          severity: 'CRITICAL',
          findingType: 'EXPOSED_SERVICE',
          evidence: null,
          detectedAt: new Date(),
          asset: { id: 'a2', name: 'vm-1' },
        },
      ]),
    },
  };
  const expiry: any = {
    listExpiries: jest.fn().mockResolvedValue([
      {
        assetId: 'a1',
        assetName: 'acme.com',
        kind: 'SSL',
        expiresAt: new Date(),
        daysLeft: 5,
        status: 'CRITICAL',
        clientName: 'Acme',
        source: 'x',
      },
    ]),
  };
  const svc = new ClientPortalService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    expiry,
  );

  it('queries only the caller client, excluding cross-server key-reuse findings, critical first', async () => {
    const r = await svc.getClientFindings('client-A');
    const where = prisma.securityFinding.findMany.mock.calls[0][0].where;
    expect(where.asset).toEqual({ clientId: 'client-A', deletedAt: null });
    expect(where.source).toEqual({ not: 'ATTACK_SURFACE_KEY_REUSE' });
    expect(r.map((f) => f.id)).toEqual(['f2', 'f1']);
    expect(r[1]).not.toHaveProperty('secret');
    expect(r[0].title).toBe('exposed service');
  });

  it('passes the caller client to the expiry list and trims internal fields', async () => {
    const r = await svc.getClientExpiries('client-A');
    expect(expiry.listExpiries).toHaveBeenCalledWith({
      clientId: 'client-A',
      withinDays: 90,
    });
    expect(r[0]).not.toHaveProperty('clientName');
    expect(r[0]).not.toHaveProperty('source');
  });

  it('returns nothing without a client id', async () => {
    expect(await svc.getClientFindings('')).toEqual([]);
    expect(await svc.getClientExpiries('')).toEqual([]);
  });
});
