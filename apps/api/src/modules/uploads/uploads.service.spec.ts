import { Test, TestingModule } from '@nestjs/testing';
import { UploadsService } from './uploads.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';

jest.mock('fs');

describe('WP-01: UploadsService Authenticated Streaming & Authorization', () => {
  let service: UploadsService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      attachment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
    jest.clearAllMocks();
  });

  it('rejects access if attachment does not exist', async () => {
    mockPrisma.attachment.findUnique.mockResolvedValue(null);

    await expect(
      service.getAttachmentForStream('att-missing', {
        id: 'staff-1',
        role: 'ADMIN',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('blocks client portal user from viewing internal attachments (BOLA / isInternal)', async () => {
    mockPrisma.attachment.findUnique.mockResolvedValue({
      id: 'att-internal',
      filename: 'confidential_payroll.pdf',
      isInternal: true,
      project: { clientId: 'client-1', organizationId: 'org-1' },
    });

    await expect(
      service.getAttachmentForStream('att-internal', {
        id: 'user-client-1',
        clientId: 'client-1',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks client portal user from viewing attachments belonging to another client', async () => {
    mockPrisma.attachment.findUnique.mockResolvedValue({
      id: 'att-client-2',
      filename: 'spec.pdf',
      isInternal: false,
      project: { clientId: 'client-2', organizationId: 'org-1' },
      uploadedByClientUserId: 'user-client-2',
    });

    await expect(
      service.getAttachmentForStream('att-client-2', {
        id: 'user-client-1',
        clientId: 'client-1',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks customer user from accessing attachments belonging to a different organization (Tenant Air-Gap)', async () => {
    mockPrisma.attachment.findUnique.mockResolvedValue({
      id: 'att-org-2',
      filename: 'org2_doc.pdf',
      isInternal: false,
      organizationId: 'org-2',
      project: { clientId: 'client-2', organizationId: 'org-2' },
    });

    await expect(
      service.getAttachmentForStream('att-org-2', {
        id: 'cust-user-1',
        userType: 'CUSTOMER',
        activeOrganizationId: 'org-1',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows customer user to access attachments in their own organization', async () => {
    mockPrisma.attachment.findUnique.mockResolvedValue({
      id: 'att-org-1',
      filename: 'org1_doc.pdf',
      originalName: 'Org1 Document.pdf',
      mimeType: 'application/pdf',
      isInternal: false,
      organizationId: 'org-1',
      project: { clientId: 'client-1', organizationId: 'org-1' },
    });
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const result = await service.getAttachmentForStream('att-org-1', {
      id: 'cust-user-1',
      userType: 'CUSTOMER',
      activeOrganizationId: 'org-1',
    });

    expect(result.attachment.id).toBe('att-org-1');
    expect(result.filePath).toBeDefined();
  });

  it('allows staff user unrestricted access to internal attachments', async () => {
    mockPrisma.attachment.findUnique.mockResolvedValue({
      id: 'att-staff',
      filename: 'internal_sop.pdf',
      originalName: 'Internal SOP.pdf',
      mimeType: 'application/pdf',
      isInternal: true,
      organizationId: null,
      project: null,
      ticket: null,
    });
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const result = await service.getAttachmentForStream('att-staff', {
      id: 'staff-admin',
      role: 'ADMIN',
      userType: 'STAFF',
    });

    expect(result.attachment.id).toBe('att-staff');
    expect(result.filePath).toBeDefined();
  });
});
