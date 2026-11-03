import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ClientPortalService } from './client-portal.service';

describe('ClientPortalService — Guardian self-service safety', () => {
  let service: ClientPortalService;
  let prisma: any;
  let wp: any;

  const managedAsset = {
    id: 'site-1',
    clientId: 'c1',
    name: 'acme.com',
    guardianAgentId: 'agent-1',
    guardianMode: 'MANAGED',
    guardianOwnership: 'NEURAVOLT',
  };

  beforeEach(() => {
    prisma = {
      asset: { findFirst: jest.fn().mockResolvedValue(managedAsset) },
      guardianAlert: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'alert-1',
          agentId: 'agent-1',
          message: 'suspicious',
          details: {
            suspiciousFiles: ['/var/www/acme/wp-content/uploads/x.php'],
          },
        }),
        update: jest.fn(),
      },
    };
    wp = {
      quarantineWordPressFile: jest.fn().mockResolvedValue({ success: true }),
      getQuarantineRecord: jest.fn(),
      restoreWordPressFile: jest.fn().mockResolvedValue({ success: true }),
    };
    service = new ClientPortalService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      wp,
    );
    (service as any).redis?.disconnect?.();
  });

  it('records which client user ran the 1-Click Fix', async () => {
    await service.oneClickFixClientAlert(
      'c1',
      'site-1',
      'alert-1',
      'owner@acme.com',
    );
    expect(wp.quarantineWordPressFile).toHaveBeenCalledWith(
      'agent-1',
      '/var/www/acme/wp-content/uploads/x.php',
      expect.objectContaining({ quarantinedBy: 'CLIENT:owner@acme.com' }),
    );
  });

  it('refuses 1-Click Fix and restore on client-owned (BYOVPS) servers instead of running them on our host', async () => {
    prisma.asset.findFirst.mockResolvedValue({
      ...managedAsset,
      guardianMode: 'BYOVPS',
      guardianOwnership: 'CLIENT',
    });
    await expect(
      service.oneClickFixClientAlert('c1', 'site-1', 'alert-1', 'o@a.com'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.restoreClientQuarantinedFile('c1', 'site-1', 'rec-1', 'o@a.com'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(wp.quarantineWordPressFile).not.toHaveBeenCalled();
    expect(wp.restoreWordPressFile).not.toHaveBeenCalled();
  });

  it('lets a client undo its own quarantine', async () => {
    wp.getQuarantineRecord.mockResolvedValue({
      id: 'rec-1',
      domain: 'acme.com',
      quarantinedBy: 'CLIENT:owner@acme.com',
    });
    await service.restoreClientQuarantinedFile(
      'c1',
      'site-1',
      'rec-1',
      'owner@acme.com',
    );
    expect(wp.restoreWordPressFile).toHaveBeenCalledWith(
      'agent-1',
      'rec-1',
      'CLIENT:owner@acme.com',
    );
  });

  it('keeps pre-change client quarantines (CLIENT_SELF_SERVICE) restorable', async () => {
    wp.getQuarantineRecord.mockResolvedValue({
      id: 'rec-1',
      domain: 'acme.com',
      quarantinedBy: 'CLIENT_SELF_SERVICE',
    });
    await service.restoreClientQuarantinedFile(
      'c1',
      'site-1',
      'rec-1',
      'owner@acme.com',
    );
    expect(wp.restoreWordPressFile).toHaveBeenCalled();
  });

  it('does not let a client restore a file NeuraVolt staff quarantined', async () => {
    wp.getQuarantineRecord.mockResolvedValue({
      id: 'rec-1',
      domain: 'acme.com',
      quarantinedBy: 'staff-user-id',
    });
    await expect(
      service.restoreClientQuarantinedFile(
        'c1',
        'site-1',
        'rec-1',
        'owner@acme.com',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(wp.restoreWordPressFile).not.toHaveBeenCalled();
  });
});
