import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  BadGatewayException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { CashfreePaymentGateway } from '../gateways/cashfree.gateway';
import {
  PaymentConfigService,
  CashfreeCredentials,
} from '../payment-config.service';

describe('Phase 3: CashfreePaymentGateway Unit & Security Tests', () => {
  let gateway: CashfreePaymentGateway;
  let mockPaymentConfigService: {
    getCashfreeCredentials: jest.Mock<Promise<CashfreeCredentials | null>, []>;
  };

  const defaultSandboxCredentials: CashfreeCredentials = {
    appId: 'CF_TEST_APP_12345',
    secretKey: 'cf_sec_super_confidential_12345',
    environment: 'sandbox',
    webhookSecret: 'cf_wh_sec_67890',
  };

  const defaultProdCredentials: CashfreeCredentials = {
    appId: 'CF_PROD_APP_99999',
    secretKey: 'cf_sec_prod_classified_88888',
    environment: 'production',
  };

  beforeEach(async () => {
    mockPaymentConfigService = {
      getCashfreeCredentials: jest
        .fn()
        .mockResolvedValue(defaultSandboxCredentials),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashfreePaymentGateway,
        {
          provide: PaymentConfigService,
          useValue: mockPaymentConfigService,
        },
      ],
    }).compile();

    gateway = module.get<CashfreePaymentGateway>(CashfreePaymentGateway);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Order Creation: Payload & Endpoints', () => {
    it('should construct correct Cashfree order payload and default sandbox URL', async () => {
      let capturedUrl = '';
      let capturedPayload: any = null;
      let capturedHeaders: any = null;

      jest
        .spyOn((gateway as any).axiosInstance, 'post')
        .mockImplementation(async (url: any, payload: any, config: any) => {
          capturedUrl = url;
          capturedPayload = payload;
          capturedHeaders = config.headers;
          return {
            data: {
              order_id: 'ORDER_1001',
              payment_session_id: 'session_cf_test_abc123',
              order_status: 'ACTIVE',
            },
          };
        });

      const result = await gateway.createOrder({
        orderId: 'ORDER_1001',
        amount: 2500.5,
        currency: 'INR',
        customer: {
          id: 'CUST_501',
          phone: '+91 9876543210',
          email: 'client@example.com',
          name: 'Acme Corp',
        },
        returnUrl:
          'https://client.neuravolt.com/payments/return?order_id={order_id}',
        orderNote: 'Invoice #INV-2026-001',
        orderTags: { invoiceId: 'inv_abc', category: 'AMC' },
        idempotencyKey: 'idemp-uuid-1234-5678',
      });

      expect(capturedUrl).toBe('https://sandbox.cashfree.com/pg/orders');
      expect(capturedPayload).toEqual({
        order_id: 'ORDER_1001',
        order_amount: 2500.5,
        order_currency: 'INR',
        customer_details: {
          customer_id: 'CUST_501',
          customer_phone: '9876543210',
          customer_email: 'client@example.com',
          customer_name: 'Acme Corp',
        },
        order_meta: {
          return_url:
            'https://client.neuravolt.com/payments/return?order_id={order_id}',
          notify_url:
            'https://teams.neuravolt.in/api/payments/cashfree/webhook',
        },
        order_note: 'Invoice #INV-2026-001',
        order_tags: { invoiceId: 'inv_abc', category: 'AMC' },
      });

      expect(capturedHeaders['x-client-id']).toBe('CF_TEST_APP_12345');
      expect(capturedHeaders['x-client-secret']).toBe(
        'cf_sec_super_confidential_12345',
      );
      expect(capturedHeaders['x-api-version']).toBe('2023-08-01');
      expect(capturedHeaders['x-idempotency-key']).toBe('idemp-uuid-1234-5678');
      expect(capturedHeaders['Content-Type']).toBe('application/json');

      expect(result).toEqual({
        gatewayOrderId: 'ORDER_1001',
        paymentSessionId: 'session_cf_test_abc123',
        orderStatus: 'ACTIVE',
        rawResponse: expect.any(Object),
      });
    });

    it('should route to production URL when environment is production', async () => {
      mockPaymentConfigService.getCashfreeCredentials.mockResolvedValue(
        defaultProdCredentials,
      );

      let capturedUrl = '';
      jest
        .spyOn((gateway as any).axiosInstance, 'post')
        .mockImplementation(async (url: any) => {
          capturedUrl = url;
          return {
            data: {
              order_id: 'ORDER_PROD_1',
              payment_session_id: 'session_prod_xyz',
              order_status: 'ACTIVE',
            },
          };
        });

      await gateway.createOrder({
        orderId: 'ORDER_PROD_1',
        amount: 5000,
        currency: 'INR',
        customer: { id: 'CUST_PROD', phone: '9876543210' },
      });

      expect(capturedUrl).toBe('https://api.cashfree.com/pg/orders');
    });

    it('should throw ServiceUnavailableException if credentials are not configured', async () => {
      mockPaymentConfigService.getCashfreeCredentials.mockResolvedValue(null);

      await expect(
        gateway.createOrder({
          orderId: 'ORDER_FAIL_1',
          amount: 1000,
          currency: 'INR',
          customer: { id: 'CUST_1', phone: '9999999999' },
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should sanitize phone number to exactly 10 digits and fallback when invalid', async () => {
      let capturedPayload: any = null;
      jest
        .spyOn((gateway as any).axiosInstance, 'post')
        .mockImplementation(async (_url: any, payload: any) => {
          capturedPayload = payload;
          return { data: { order_id: 'O1', payment_session_id: 'sess1' } };
        });

      // Valid phone with special characters and country code
      await gateway.createOrder({
        orderId: 'O1',
        amount: 100,
        currency: 'INR',
        customer: { id: 'C1', phone: '+91-9123456789' },
      });
      expect(capturedPayload.customer_details.customer_phone).toBe(
        '9123456789',
      );

      // Invalid short phone fallback
      await gateway.createOrder({
        orderId: 'O2',
        amount: 100,
        currency: 'INR',
        customer: { id: 'C2', phone: '123' },
      });
      expect(capturedPayload.customer_details.customer_phone).toBe(
        '9999999999',
      );
    });
  });

  describe('Currency and Amount Handling', () => {
    it('should reject non-INR currency', async () => {
      await expect(
        gateway.createOrder({
          orderId: 'ORD_USD',
          amount: 100,
          currency: 'USD',
          customer: { id: 'C1', phone: '9999999999' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject zero or negative amounts', async () => {
      await expect(
        gateway.createOrder({
          orderId: 'ORD_ZERO',
          amount: 0,
          currency: 'INR',
          customer: { id: 'C1', phone: '9999999999' },
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        gateway.createOrder({
          orderId: 'ORD_NEG',
          amount: -50,
          currency: 'INR',
          customer: { id: 'C1', phone: '9999999999' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-finite amounts (NaN, Infinity)', async () => {
      await expect(
        gateway.createOrder({
          orderId: 'ORD_NAN',
          amount: NaN,
          currency: 'INR',
          customer: { id: 'C1', phone: '9999999999' },
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        gateway.createOrder({
          orderId: 'ORD_INF',
          amount: Infinity,
          currency: 'INR',
          customer: { id: 'C1', phone: '9999999999' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should round floating point values to exactly 2 decimal places without precision drift', async () => {
      let capturedPayload: any = null;
      jest
        .spyOn((gateway as any).axiosInstance, 'post')
        .mockImplementation(async (_url: any, payload: any) => {
          capturedPayload = payload;
          return { data: { order_id: 'O1', payment_session_id: 'sess1' } };
        });

      await gateway.createOrder({
        orderId: 'O_FLOAT',
        amount: 1234.5678,
        currency: 'INR',
        customer: { id: 'C1', phone: '9999999999' },
      });

      expect(capturedPayload.order_amount).toBe(1234.57);
    });
  });

  describe('Error Handling, Malformed Responses & Secret Leakage Prevention', () => {
    it('should handle Cashfree API 4xx response gracefully without leaking secrets', async () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});

      jest.spyOn((gateway as any).axiosInstance, 'post').mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            message: 'order_amount is invalid',
            code: 'order_amount_invalid',
            type: 'invalid_request_error',
          },
        },
        config: {
          headers: {
            'x-client-secret': defaultSandboxCredentials.secretKey,
          },
        },
      });

      let caughtError: any;
      try {
        await gateway.createOrder({
          orderId: 'ORD_400',
          amount: 100,
          currency: 'INR',
          customer: { id: 'C1', phone: '9999999999' },
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(BadRequestException);
      expect(caughtError.message).toContain(
        'Cashfree request failed: order_amount is invalid',
      );
      // Verify secret is NOT in error message or object
      expect(JSON.stringify(caughtError)).not.toContain(
        defaultSandboxCredentials.secretKey,
      );

      // Verify secret was never passed into the logger
      for (const call of loggerSpy.mock.calls) {
        const loggedText = call.join(' ');
        expect(loggedText).not.toContain(defaultSandboxCredentials.secretKey);
      }
    });

    it('should handle Cashfree API 5xx response gracefully as BadGatewayException', async () => {
      jest.spyOn((gateway as any).axiosInstance, 'post').mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 502,
          data: { message: 'Bad Gateway upstream' },
        },
      });

      await expect(
        gateway.createOrder({
          orderId: 'ORD_500',
          amount: 100,
          currency: 'INR',
          customer: { id: 'C1', phone: '9999999999' },
        }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('should handle timeout and network failure as BadGatewayException', async () => {
      jest.spyOn((gateway as any).axiosInstance, 'post').mockRejectedValue({
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      });

      await expect(
        gateway.createOrder({
          orderId: 'ORD_TIMEOUT',
          amount: 100,
          currency: 'INR',
          customer: { id: 'C1', phone: '9999999999' },
        }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('should handle malformed Cashfree response without crashing', async () => {
      jest.spyOn((gateway as any).axiosInstance, 'post').mockResolvedValue({
        data: null,
      });

      await expect(
        gateway.createOrder({
          orderId: 'ORD_MALFORMED',
          amount: 100,
          currency: 'INR',
          customer: { id: 'C1', phone: '9999999999' },
        }),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('Fetch Payment Status', () => {
    it('should fetch payment details from /orders/{order_id}/payments when payments exist', async () => {
      jest.spyOn((gateway as any).axiosInstance, 'get').mockResolvedValue({
        data: [
          {
            cf_payment_id: '987654321',
            order_id: 'ORD_FETCH_1',
            payment_status: 'SUCCESS',
            payment_amount: 1500,
            payment_currency: 'INR',
            payment_time: '2026-09-19T10:00:00Z',
            payment_method: 'upi',
            bank_reference: 'UPI1234567890',
          },
        ],
      });

      const details = await gateway.fetchPaymentStatus('ORD_FETCH_1');

      expect(details).toEqual({
        paymentId: '987654321',
        orderId: 'ORD_FETCH_1',
        status: 'SUCCESS',
        amount: 1500,
        currency: 'INR',
        paymentTime: new Date('2026-09-19T10:00:00Z'),
        paymentMethod: 'upi',
        bankReference: 'UPI1234567890',
        rawResponse: expect.any(Object),
      });
    });

    it('should fallback to /orders/{order_id} when no payment attempts exist yet', async () => {
      jest
        .spyOn((gateway as any).axiosInstance, 'get')
        .mockImplementation(async (url: string) => {
          if (url.includes('/payments')) {
            return { data: [] };
          }
          return {
            data: {
              order_id: 'ORD_FETCH_ACTIVE',
              order_status: 'ACTIVE',
              order_amount: 2000,
              order_currency: 'INR',
            },
          };
        });

      const details = await gateway.fetchPaymentStatus('ORD_FETCH_ACTIVE');

      expect(details).toEqual({
        paymentId: '',
        orderId: 'ORD_FETCH_ACTIVE',
        status: 'PENDING',
        amount: 2000,
        currency: 'INR',
        rawResponse: expect.any(Object),
      });
    });
  });

  describe('Webhook Signature Verification (HMAC-SHA256)', () => {
    const rawBody = JSON.stringify({
      data: {
        order: { order_id: 'ORDER_WH_123', order_amount: 500 },
        payment: { cf_payment_id: 112233, payment_status: 'SUCCESS' },
      },
      event_time: '2026-09-19T12:00:00Z',
      type: 'PAYMENT_SUCCESS_WEBHOOK',
    });

    it('should successfully verify a valid webhook signature generated with secretKey/webhookSecret', async () => {
      const timestamp = String(Date.now());
      // Cashfree formula: signedPayload = `${timestamp}${rawBody}`
      const signedPayload = `${timestamp}${rawBody}`;
      // In defaultSandboxCredentials, webhookSecret is 'cf_wh_sec_67890'
      const validSignature = crypto
        .createHmac('sha256', defaultSandboxCredentials.webhookSecret!)
        .update(signedPayload)
        .digest('base64');

      const isValid = await gateway.verifyWebhookSignature({
        signature: validSignature,
        timestamp,
        rawBody,
      });

      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', async () => {
      const timestamp = String(Date.now());
      const isValid = await gateway.verifyWebhookSignature({
        signature: 'invalid_base64_signature_here=',
        timestamp,
        rawBody,
      });

      expect(isValid).toBe(false);
    });

    it('should reject tampered body with original signature', async () => {
      const timestamp = String(Date.now());
      const signedPayload = `${timestamp}${rawBody}`;
      const validSignature = crypto
        .createHmac('sha256', defaultSandboxCredentials.webhookSecret!)
        .update(signedPayload)
        .digest('base64');

      const tamperedBody = rawBody.replace('ORDER_WH_123', 'ORDER_WH_HACKED');

      const isValid = await gateway.verifyWebhookSignature({
        signature: validSignature,
        timestamp,
        rawBody: tamperedBody,
      });

      expect(isValid).toBe(false);
    });

    it('should return false if signature, timestamp, or rawBody are missing', async () => {
      expect(
        await gateway.verifyWebhookSignature({
          signature: '',
          timestamp: '123',
          rawBody,
        }),
      ).toBe(false);
      expect(
        await gateway.verifyWebhookSignature({
          signature: 'sig',
          timestamp: '',
          rawBody,
        }),
      ).toBe(false);
      expect(
        await gateway.verifyWebhookSignature({
          signature: 'sig',
          timestamp: '123',
          rawBody: '' as any,
        }),
      ).toBe(false);
    });

    it('should reject stale timestamp to prevent replay attacks (> 10 minutes)', async () => {
      const staleTimestamp = String(Date.now() - 15 * 60 * 1000); // 15 mins ago
      const signedPayload = `${staleTimestamp}${rawBody}`;
      const signature = crypto
        .createHmac('sha256', defaultSandboxCredentials.webhookSecret!)
        .update(signedPayload)
        .digest('base64');

      const isValid = await gateway.verifyWebhookSignature({
        signature,
        timestamp: staleTimestamp,
        rawBody,
      });

      expect(isValid).toBe(false);
    });
  });

  describe('Accounting Isolation Rule', () => {
    it('gateway must never interact with Payment accounting model or create Payment records', () => {
      // Ensure CashfreePaymentGateway does not have prismaService or payment model injection
      expect((gateway as any).prisma).toBeUndefined();
      expect((gateway as any).billingService).toBeUndefined();
    });
  });
});
