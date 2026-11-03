import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from '../payments.controller';
import { PaymentsService } from '../payments.service';
import { PdfService } from '../../../common/pdf/pdf.service';
import { ManualPaymentsService } from '../../billing/manual-payments.service';

describe('Phase 4: PaymentsController Webhook Endpoint Tests', () => {
  let controller: PaymentsController;
  let mockPaymentsService: {
    processCashfreeWebhook: jest.Mock;
  };

  beforeEach(async () => {
    mockPaymentsService = {
      processCashfreeWebhook: jest.fn().mockResolvedValue({
        success: true,
        message: 'Payment successfully verified and recorded',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
        {
          provide: PdfService,
          useValue: { generateReceiptPdf: jest.fn() },
        },
        {
          provide: ManualPaymentsService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('handleCashfreeWebhook passes exact rawBody and headers to PaymentsService', async () => {
    const rawBody = '{"data":{"order":{"order_id":"cf_123"}}}';
    const headers = {
      'x-webhook-signature': 'sig_123',
      'x-webhook-timestamp': '1726750000',
    };
    const req = { rawBody, body: JSON.parse(rawBody) };

    const result = await controller.handleCashfreeWebhook(req, headers);

    expect(result).toEqual({
      success: true,
      message: 'Payment successfully verified and recorded',
    });
    expect(mockPaymentsService.processCashfreeWebhook).toHaveBeenCalledWith(
      rawBody,
      headers,
    );
  });
});
