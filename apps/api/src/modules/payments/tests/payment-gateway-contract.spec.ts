import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  IPaymentGateway,
  PaymentCapability,
  CreatePaymentOrderInput,
  GatewayOrderResult,
  GatewayPaymentDetails,
  WebhookVerificationParams,
  NormalizedWebhookEvent,
} from '../gateways/payment-gateway.interface';
import { CashfreePaymentGateway } from '../gateways/cashfree.gateway';
import { PaymentGatewayRegistry } from '../gateways/payment-gateway.registry';
import { CollectCheckoutService } from '../../collects/services/collect-checkout.service';

/**
 * Reusable Mock Payment Gateway Adapter.
 * Represents a future new provider (e.g. NextGenPay) implementing IPaymentGateway.
 */
class MockContractPaymentGateway implements IPaymentGateway {
  readonly gatewayName = 'MOCK_GATEWAY';

  getSupportedCapabilities(): PaymentCapability[] {
    return [PaymentCapability.ONE_TIME_PAYMENT];
  }

  supportsCapability(capability: PaymentCapability): boolean {
    return this.getSupportedCapabilities().includes(capability);
  }

  async createOrder(
    input: CreatePaymentOrderInput,
  ): Promise<GatewayOrderResult> {
    if (input.currency !== 'INR') {
      throw new BadRequestException('Mock gateway only supports INR currency');
    }
    return {
      gatewayOrderId: input.orderId,
      paymentSessionId: `mock_session_${input.orderId}_${Date.now()}`,
      orderStatus: 'ACTIVE',
      rawResponse: { mock_id: 'mock_123' },
    };
  }

  async fetchPaymentStatus(
    gatewayOrderId: string,
  ): Promise<GatewayPaymentDetails | null> {
    return {
      paymentId: `mock_pay_${gatewayOrderId}`,
      orderId: gatewayOrderId,
      status: 'SUCCESS',
      amount: 1000,
      currency: 'INR',
      paymentMethod: 'UPI',
    };
  }

  async verifyWebhookSignature(
    params: WebhookVerificationParams,
  ): Promise<boolean> {
    if (!params.signature || !params.timestamp || !params.rawBody) {
      return false;
    }
    const secret = params.secret || 'mock_secret_key';
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${params.timestamp}${params.rawBody}`)
      .digest('base64');
    return expected === params.signature;
  }

  parseWebhookPayload(
    rawBody: string,
    _headers?: Record<string, string>,
  ): NormalizedWebhookEvent {
    let parsed: any;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Malformed JSON webhook payload');
    }

    if (!parsed.event_order_id) {
      throw new BadRequestException('Webhook payload missing event_order_id');
    }

    return {
      orderId: parsed.event_order_id,
      gatewayPaymentId: parsed.event_payment_id || 'mock_pay_default',
      status: parsed.event_status === 'PAID' ? 'SUCCESS' : 'FAILED',
      amount: parsed.event_amount ? Number(parsed.event_amount) : undefined,
      currency: parsed.event_currency || 'INR',
      eventTime: parsed.event_time ? new Date(parsed.event_time) : undefined,
      rawEvent: parsed,
    };
  }
}

describe('Payment Gateway Contract Tests (Zero-Product-Change Invariance)', () => {
  describe('Provider Contract Conformance', () => {
    const mockConfigService: any = {
      getCashfreeCredentials: jest.fn().mockResolvedValue({
        appId: 'CF_TEST_APP',
        secretKey: 'mock_secret_key',
        environment: 'sandbox',
        webhookSecret: 'mock_secret_key',
      }),
    };

    const cashfreeGateway = new CashfreePaymentGateway(mockConfigService);
    const mockContractGateway = new MockContractPaymentGateway();

    const gatewaysToTest: Array<{ name: string; gateway: IPaymentGateway }> = [
      { name: 'CashfreePaymentGateway', gateway: cashfreeGateway },
      {
        name: 'MockContractPaymentGateway (New Future Provider)',
        gateway: mockContractGateway,
      },
    ];

    gatewaysToTest.forEach(({ name, gateway }) => {
      describe(`Gateway Adapter: ${name}`, () => {
        it('accurately declares supported and unsupported capabilities', () => {
          expect(
            gateway.supportsCapability(PaymentCapability.ONE_TIME_PAYMENT),
          ).toBe(true);
          // Strictly unsupported until implemented
          expect(
            gateway.supportsCapability(
              PaymentCapability.RECURRING_SUBSCRIPTION,
            ),
          ).toBe(false);
          expect(
            gateway.supportsCapability(PaymentCapability.UPI_AUTOPAY),
          ).toBe(false);
          expect(gateway.supportsCapability(PaymentCapability.REFUNDS)).toBe(
            false,
          );

          const capabilities = gateway.getSupportedCapabilities();
          expect(capabilities).toContain(PaymentCapability.ONE_TIME_PAYMENT);
          expect(capabilities).not.toContain(
            PaymentCapability.RECURRING_SUBSCRIPTION,
          );
        });

        it('rejects unsupported currencies during order creation', async () => {
          await expect(
            gateway.createOrder({
              orderId: 'ord_test_curr',
              amount: 500,
              currency: 'USD',
              customer: { id: 'cust_1', phone: '9876543210' },
            }),
          ).rejects.toThrow(BadRequestException);
        });

        it('verifies valid HMAC-SHA256 signature and rejects forged signatures', async () => {
          const secret = 'mock_secret_key';
          const timestamp = String(Math.floor(Date.now() / 1000));
          const rawBody = JSON.stringify({ hello: 'world' });

          const validSignature = crypto
            .createHmac('sha256', secret)
            .update(`${timestamp}${rawBody}`)
            .digest('base64');

          const isValid = await gateway.verifyWebhookSignature({
            signature: validSignature,
            timestamp,
            rawBody,
            secret,
          });
          expect(isValid).toBe(true);

          const isInvalid = await gateway.verifyWebhookSignature({
            signature: 'invalid_forged_base64_signature',
            timestamp,
            rawBody,
            secret,
          });
          expect(isInvalid).toBe(false);
        });

        it('rejects missing signature or missing timestamp headers gracefully without crashing', async () => {
          const isMissingSig = await gateway.verifyWebhookSignature({
            signature: '',
            timestamp: '1726750000',
            rawBody: '{}',
          });
          expect(isMissingSig).toBe(false);

          const isMissingTs = await gateway.verifyWebhookSignature({
            signature: 'some_sig',
            timestamp: '',
            rawBody: '{}',
          });
          expect(isMissingTs).toBe(false);
        });

        it('parses malformed webhook body throwing BadRequestException', () => {
          expect(() => gateway.parseWebhookPayload('not-json-content')).toThrow(
            BadRequestException,
          );
        });
      });
    });
  });

  describe('Integration Invariance Proof: New Provider Pluggability', () => {
    it('integrates a new gateway adapter via PaymentGatewayRegistry without changing Collects checkout contracts', async () => {
      const mockCashfree: any = {
        gatewayName: 'CASHFREE',
        supportsCapability: jest.fn().mockReturnValue(true),
      };
      const mockRazorpay: any = {
        gatewayName: 'RAZORPAY',
        supportsCapability: jest.fn().mockReturnValue(false),
      };

      const registry = new PaymentGatewayRegistry(mockCashfree, mockRazorpay);
      const newProvider = new MockContractPaymentGateway();

      // Register new future provider into Collects registry
      registry.registerGateway(newProvider);
      expect(registry.hasGateway('MOCK_GATEWAY')).toBe(true);

      const mockPrisma: any = {
        paymentAttempt: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation((args: any) => ({
            id: 'attempt-mock-1',
            ...args.data,
            createdAt: new Date(),
          })),
          update: jest.fn().mockResolvedValue({}),
        },
      };

      const mockPaymentConfig: any = {
        resolveGatewayAccount: jest.fn().mockResolvedValue({
          accountId: 'acc-mock-provider-1',
          provider: 'MOCK_GATEWAY', // Resolves to new provider
          name: 'NextGen Provider Account',
          environment: 'production',
          credentials: { appId: 'mock_app', secretKey: 'mock_sec' },
          isEnabled: true,
          isDefault: true,
        }),
      };

      const checkoutService = new CollectCheckoutService(
        mockPrisma,
        registry,
        mockPaymentConfig,
      );

      const mockAppContext: any = {
        app: { appId: 'reach_ai', name: 'Reach AI' },
        apiKey: { environment: 'LIVE' },
      };

      // Standard Product Request (from Reach AI / FoxRun SDK)
      const standardProductRequest = {
        orderId: 'reach_sub_999',
        amount: '1499.00',
        currency: 'INR' as const,
        customer: {
          phone: '9876543210',
          email: 'user@reach.neuravolt.cloud',
          name: 'Reach Customer',
        },
        metadata: { planId: 'PRO_YEARLY' },
      };

      // Call Checkout Service
      const result = await checkoutService.createCheckoutSession(
        mockAppContext,
        standardProductRequest,
      );

      // Verify the public SDK response contract is 100% PRESERVED
      expect(result).toEqual(
        expect.objectContaining({
          paymentSessionId: expect.stringContaining('mock_session_'),
          gatewayOrderId: expect.stringContaining('reach_sub_999'),
          orderId: 'reach_sub_999',
          amount: '1499.00',
          currency: 'INR',
          environment: 'LIVE',
          expiresAt: expect.any(String),
        }),
      );

      // Verify attempt was bound to the new provider and gateway account
      expect(mockPrisma.paymentAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          appId: 'reach_ai',
          externalOrderId: 'reach_sub_999',
          gateway: 'MOCK_GATEWAY',
          gatewayAccountId: 'acc-mock-provider-1',
          amount: 1499,
          currency: 'INR',
        }),
      });
    });
  });
});
