import { Test, TestingModule } from '@nestjs/testing';
import { ClientPortalController } from '../../clients/client-portal.controller';
import { ClientPortalService } from '../../clients/client-portal.service';
import { PdfService } from '../../../common/pdf/pdf.service';
import { UploadsService } from '../../uploads/uploads.service';
import { PaymentConfigService } from '../payment-config.service';
import { PaymentsService } from '../payments.service';
import { ManualPaymentsService } from '../../billing/manual-payments.service';
import { ClientJwtAuthGuard } from '../../auth/guards/client-jwt-auth.guard';

describe('Phase 2, Phase 4 & Phase 5: ClientPortalController Payment Endpoints & Security', () => {
  let controller: ClientPortalController;
  let mockPaymentConfigService: {
    getPaymentConfig: jest.Mock;
  };
  let mockPaymentsService: {
    createOnlinePaymentSession: jest.Mock;
  };
  let mockManualPaymentsService: {
    submitManualPayment: jest.Mock;
    getInvoiceSubmissionsForClient: jest.Mock;
    getProofFile: jest.Mock;
  };

  beforeEach(async () => {
    mockPaymentConfigService = {
      getPaymentConfig: jest.fn(),
    };
    mockPaymentsService = {
      createOnlinePaymentSession: jest.fn(),
    };
    mockManualPaymentsService = {
      submitManualPayment: jest.fn(),
      getInvoiceSubmissionsForClient: jest.fn(),
      getProofFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientPortalController],
      providers: [
        {
          provide: ClientPortalService,
          useValue: {},
        },
        {
          provide: PdfService,
          useValue: {},
        },
        {
          provide: UploadsService,
          useValue: {},
        },
        {
          provide: PaymentConfigService,
          useValue: mockPaymentConfigService,
        },
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
        {
          provide: ManualPaymentsService,
          useValue: mockManualPaymentsService,
        },
      ],
    }).compile();

    controller = module.get<ClientPortalController>(ClientPortalController);
  });

  it('ClientPortalController must have ClientJwtAuthGuard applied at controller level', () => {
    const guards = Reflect.getMetadata('__guards__', ClientPortalController);
    expect(guards).toBeDefined();
    expect(guards).toContain(ClientJwtAuthGuard);
  });

  it('getPaymentConfig should return only safe config and never allow client params to mutate settings', async () => {
    mockPaymentConfigService.getPaymentConfig.mockResolvedValue({
      onlinePaymentEnabled: true,
      manualPaymentEnabled: true,
      activeOnlineGateway: 'CASHFREE',
    });

    const result = await controller.getPaymentConfig();

    expect(result).toEqual({
      onlinePaymentEnabled: true,
      manualPaymentEnabled: true,
      activeOnlineGateway: 'CASHFREE',
    });

    // Verify exactly 3 keys and no secrets
    expect(Object.keys(result).sort()).toEqual([
      'activeOnlineGateway',
      'manualPaymentEnabled',
      'onlinePaymentEnabled',
    ]);
  });

  it('createOnlinePaymentSession delegates client ID and invoice ID to PaymentsService', async () => {
    mockPaymentsService.createOnlinePaymentSession.mockResolvedValue({
      paymentSessionId: 'sess_123',
      gatewayOrderId: 'order_123',
      amount: 500,
      currency: 'INR',
    });

    const req = { user: { clientId: 'client_abc' } };
    const res = await controller.createOnlinePaymentSession(req, 'inv_xyz');

    expect(res).toEqual({
      paymentSessionId: 'sess_123',
      gatewayOrderId: 'order_123',
      amount: 500,
      currency: 'INR',
    });
    expect(mockPaymentsService.createOnlinePaymentSession).toHaveBeenCalledWith(
      'client_abc',
      'inv_xyz',
    );
  });

  it('submitManualPayment delegates client ID, invoice ID, dto and file to ManualPaymentsService', async () => {
    mockManualPaymentsService.submitManualPayment.mockResolvedValue({
      submissionId: 'sub_xyz',
      status: 'PENDING',
    });

    const req = { user: { clientId: 'client_abc' } };
    const dto = {
      amount: 1000,
      paymentMethod: 'UPI' as const,
      utrNumber: 'UTR_123',
      paymentDate: '2026-09-19',
    };
    const file = { originalname: 'proof.png' } as any;

    const res = await controller.submitManualPayment(req, 'inv_xyz', dto, file);

    expect(res).toEqual({ submissionId: 'sub_xyz', status: 'PENDING' });
    expect(mockManualPaymentsService.submitManualPayment).toHaveBeenCalledWith(
      'client_abc',
      'inv_xyz',
      dto,
      file,
    );
  });
});
