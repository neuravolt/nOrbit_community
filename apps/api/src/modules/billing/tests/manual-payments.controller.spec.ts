import { Test, TestingModule } from '@nestjs/testing';
import { ManualPaymentsController } from '../manual-payments.controller';
import { ManualPaymentsService } from '../manual-payments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../users/guards/roles.guard';
import { PermissionsGuard } from '../../roles/guards/permissions.guard';

describe('Phase 5: ManualPaymentsController Unit Tests', () => {
  let controller: ManualPaymentsController;
  let mockService: any;

  beforeEach(async () => {
    mockService = {
      listManualPayments: jest
        .fn()
        .mockResolvedValue({ data: [], meta: { total: 0 } }),
      approveManualPayment: jest.fn().mockResolvedValue({ success: true }),
      rejectManualPayment: jest.fn().mockResolvedValue({ success: true }),
      getProofFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManualPaymentsController],
      providers: [
        {
          provide: ManualPaymentsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ManualPaymentsController>(ManualPaymentsController);
  });

  it('list delegates to manualPaymentsService.listManualPayments', async () => {
    const query = { status: 'PENDING', page: 1, limit: 10 };
    await controller.list(query);
    expect(mockService.listManualPayments).toHaveBeenCalledWith(query);
  });

  it('approve delegates to manualPaymentsService.approveManualPayment with admin user ID', async () => {
    const req = { user: { id: 'admin-123' } };
    await controller.approve('sub-1', req);
    expect(mockService.approveManualPayment).toHaveBeenCalledWith(
      'sub-1',
      'admin-123',
    );
  });

  it('reject delegates to manualPaymentsService.rejectManualPayment with reason', async () => {
    const req = { user: { id: 'admin-123' } };
    await controller.reject('sub-1', { rejectionReason: 'Invalid UTR' }, req);
    expect(mockService.rejectManualPayment).toHaveBeenCalledWith(
      'sub-1',
      'admin-123',
      'Invalid UTR',
    );
  });
});
