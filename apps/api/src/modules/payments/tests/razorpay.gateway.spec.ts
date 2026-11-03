import { ForbiddenException } from '@nestjs/common';
import { RazorpayPaymentGateway } from '../gateways/razorpay.gateway';

describe('Phase 3: RazorpayPaymentGateway Isolation Tests', () => {
  let gateway: RazorpayPaymentGateway;

  beforeEach(() => {
    gateway = new RazorpayPaymentGateway();
  });

  it('gatewayName should be RAZORPAY', () => {
    expect(gateway.gatewayName).toBe('RAZORPAY');
  });

  it('createOrder must throw ForbiddenException stating Razorpay is disabled', async () => {
    await expect(
      gateway.createOrder({
        orderId: 'ORD_1',
        amount: 100,
        currency: 'INR',
        customer: { id: 'CUST_1', phone: '9999999999' },
      }),
    ).rejects.toThrow(
      new ForbiddenException('Razorpay is disabled in favor of Cashfree.'),
    );
  });

  it('fetchPaymentStatus must throw ForbiddenException', async () => {
    await expect(gateway.fetchPaymentStatus('ORD_1')).rejects.toThrow(
      new ForbiddenException('Razorpay is disabled in favor of Cashfree.'),
    );
  });

  it('verifyWebhookSignature must throw ForbiddenException', async () => {
    await expect(
      gateway.verifyWebhookSignature({
        signature: 'sig',
        rawBody: '{}',
        timestamp: '123',
      }),
    ).rejects.toThrow(
      new ForbiddenException('Razorpay is disabled in favor of Cashfree.'),
    );
  });
});
