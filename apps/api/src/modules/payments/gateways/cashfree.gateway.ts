import {
  Injectable,
  Logger,
  BadRequestException,
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  PaymentConfigService,
  CashfreeCredentials,
} from '../payment-config.service';
import {
  IPaymentGateway,
  PaymentCapability,
  CreatePaymentOrderInput,
  GatewayOrderResult,
  GatewayPaymentDetails,
  WebhookVerificationParams,
  NormalizedWebhookEvent,
} from './payment-gateway.interface';

@Injectable()
export class CashfreePaymentGateway implements IPaymentGateway {
  readonly gatewayName = 'CASHFREE';
  private readonly logger = new Logger(CashfreePaymentGateway.name);

  /**
   * Returns list of capabilities implemented and verified for Cashfree adapter.
   * RECURRING_SUBSCRIPTION, UPI_AUTOPAY and REFUNDS remain unsupported until implemented.
   */
  getSupportedCapabilities(): PaymentCapability[] {
    return [PaymentCapability.ONE_TIME_PAYMENT];
  }

  supportsCapability(capability: PaymentCapability): boolean {
    return this.getSupportedCapabilities().includes(capability);
  }

  // Cashfree API Specification Constants
  public static readonly API_VERSION = '2023-08-01';
  public static readonly SANDBOX_URL = 'https://sandbox.cashfree.com/pg';
  public static readonly PRODUCTION_URL = 'https://api.cashfree.com/pg';
  public static readonly DEFAULT_TIMEOUT_MS = 10000;

  private readonly axiosInstance: AxiosInstance;

  constructor(private readonly paymentConfigService: PaymentConfigService) {
    this.axiosInstance = axios.create({
      timeout: CashfreePaymentGateway.DEFAULT_TIMEOUT_MS,
    });
  }

  /**
   * Resolves Cashfree base URL based on credentials environment.
   */
  private getBaseUrl(environment: 'sandbox' | 'production'): string {
    return environment === 'production'
      ? CashfreePaymentGateway.PRODUCTION_URL
      : CashfreePaymentGateway.SANDBOX_URL;
  }

  /**
   * Sanitizes phone number to meet Cashfree validation requirements (min 10 digits).
   */
  private sanitizePhone(rawPhone?: string): string {
    if (!rawPhone) return '9999999999';
    const digits = rawPhone.replace(/\D/g, '');
    if (digits.length >= 10) {
      return digits.slice(-10);
    }
    return '9999999999';
  }

  /**
   * Formats and validates currency amounts to avoid floating-point issues.
   */
  private formatAmount(amount: number): number {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a positive finite number');
    }
    // Round to 2 decimal places strictly
    return Math.round(amount * 100) / 100;
  }

  /**
   * Safely formats errors without exposing API secrets or credentials.
   */
  private handleAxiosError(
    err: unknown,
    operation: string,
    orderId?: string,
  ): never {
    const errorDetails = err as AxiosError<any>;
    const status = errorDetails.response?.status;
    const responseData = errorDetails.response?.data;
    const safeMessage =
      responseData?.message ||
      responseData?.description ||
      errorDetails.message ||
      'Cashfree Gateway Error';
    const safeCode = responseData?.code || errorDetails.code || 'GATEWAY_ERROR';

    // Log safely without headers, auth keys, or configs
    this.logger.error(
      `Cashfree ${operation} failed: orderId=${orderId || 'N/A'}, status=${status || 'N/A'}, code=${safeCode}, message=${safeMessage}`,
    );

    if (status && status >= 400 && status < 500) {
      throw new BadRequestException(`Cashfree request failed: ${safeMessage}`);
    }

    throw new BadGatewayException(
      `Payment gateway unavailable or failed: ${safeMessage}`,
    );
  }

  /**
   * Creates an order session in Cashfree for online payment checkout.
   */
  async createOrder(
    input: CreatePaymentOrderInput,
  ): Promise<GatewayOrderResult> {
    if (input.currency !== 'INR') {
      throw new BadRequestException(
        'Cashfree gateway only supports INR currency',
      );
    }

    const validatedAmount = this.formatAmount(input.amount);

    if (!input.orderId || input.orderId.trim() === '') {
      throw new BadRequestException(
        'orderId is required for gateway order creation',
      );
    }

    if (!input.customer?.id) {
      throw new BadRequestException(
        'customer.id is required for Cashfree order creation',
      );
    }

    const credentials: CashfreeCredentials | null =
      (input as any).credentials ||
      (await this.paymentConfigService.getCashfreeCredentials());

    if (!credentials || !credentials.appId || !credentials.secretKey) {
      this.logger.error('Cashfree credentials missing or incomplete');
      throw new ServiceUnavailableException(
        'Payment gateway credentials are not configured',
      );
    }

    const baseUrl = this.getBaseUrl(credentials.environment);
    const customerPhone = this.sanitizePhone(input.customer.phone);

    const headers: Record<string, string> = {
      'x-client-id': credentials.appId,
      'x-client-secret': credentials.secretKey,
      'x-api-version': CashfreePaymentGateway.API_VERSION,
      'Content-Type': 'application/json',
    };

    if (input.idempotencyKey) {
      headers['x-idempotency-key'] = input.idempotencyKey;
    }

    const payload: Record<string, any> = {
      order_id: input.orderId,
      order_amount: validatedAmount,
      order_currency: 'INR',
      customer_details: {
        customer_id: input.customer.id,
        customer_phone: customerPhone,
        ...(input.customer.email
          ? { customer_email: input.customer.email }
          : {}),
        ...(input.customer.name ? { customer_name: input.customer.name } : {}),
      },
    };

    const notifyUrl =
      input.notifyUrl ||
      process.env.CASHFREE_NOTIFY_URL ||
      'https://teams.neuravolt.in/api/payments/cashfree/webhook';

    if (input.returnUrl || notifyUrl) {
      payload.order_meta = {
        ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
        ...(notifyUrl ? { notify_url: notifyUrl } : {}),
      };
    }

    if (input.orderNote) {
      payload.order_note = input.orderNote;
    }

    if (input.orderTags) {
      payload.order_tags = input.orderTags;
    }

    try {
      const response = await this.axiosInstance.post(
        `${baseUrl}/orders`,
        payload,
        {
          headers,
        },
      );

      const data = response.data;
      if (!data || typeof data !== 'object') {
        throw new BadGatewayException(
          'Malformed response received from Cashfree',
        );
      }

      return {
        gatewayOrderId: data.order_id || input.orderId,
        paymentSessionId: data.payment_session_id,
        orderStatus: data.order_status || 'ACTIVE',
        rawResponse: data,
      };
    } catch (err) {
      this.handleAxiosError(err, 'createOrder', input.orderId);
    }
  }

  /**
   * Fetches the latest payment details for a given Cashfree order ID.
   */
  async fetchPaymentStatus(
    gatewayOrderId: string,
    overrideCredentials?: CashfreeCredentials,
  ): Promise<GatewayPaymentDetails | null> {
    if (!gatewayOrderId || gatewayOrderId.trim() === '') {
      throw new BadRequestException('gatewayOrderId is required');
    }

    const credentials =
      overrideCredentials ||
      (await this.paymentConfigService.getCashfreeCredentials());
    if (!credentials || !credentials.appId || !credentials.secretKey) {
      throw new ServiceUnavailableException(
        'Payment gateway credentials are not configured',
      );
    }

    const baseUrl = this.getBaseUrl(credentials.environment);
    const headers: Record<string, string> = {
      'x-client-id': credentials.appId,
      'x-client-secret': credentials.secretKey,
      'x-api-version': CashfreePaymentGateway.API_VERSION,
      'Content-Type': 'application/json',
    };

    try {
      // 1. First fetch payments for this order
      const paymentsResponse = await this.axiosInstance.get(
        `${baseUrl}/orders/${encodeURIComponent(gatewayOrderId)}/payments`,
        { headers },
      );

      const payments = paymentsResponse.data;
      if (Array.isArray(payments) && payments.length > 0) {
        // Pick the most relevant payment attempt (e.g. successful or latest)
        const successful = payments.find(
          (p: any) => p.payment_status === 'SUCCESS',
        );
        const payment = successful || payments[payments.length - 1];

        let mappedStatus: GatewayPaymentDetails['status'] = 'PENDING';
        if (payment.payment_status === 'SUCCESS') mappedStatus = 'SUCCESS';
        else if (payment.payment_status === 'FAILED') mappedStatus = 'FAILED';
        else if (payment.payment_status === 'USER_DROPPED')
          mappedStatus = 'USER_DROPPED';
        else if (payment.payment_status === 'CANCELLED')
          mappedStatus = 'CANCELLED';

        return {
          paymentId: String(payment.cf_payment_id || payment.payment_id || ''),
          orderId: String(payment.order_id || gatewayOrderId),
          status: mappedStatus,
          amount: Number(payment.payment_amount || 0),
          currency: String(payment.payment_currency || 'INR'),
          paymentTime: payment.payment_time
            ? new Date(payment.payment_time)
            : undefined,
          paymentMethod:
            typeof payment.payment_method === 'object'
              ? JSON.stringify(payment.payment_method)
              : String(payment.payment_method || ''),
          bankReference: payment.bank_reference,
          rawResponse: payment,
        };
      }

      // 2. Fallback to order status if no payments array returned
      const orderResponse = await this.axiosInstance.get(
        `${baseUrl}/orders/${encodeURIComponent(gatewayOrderId)}`,
        { headers },
      );
      const order = orderResponse.data;
      if (!order) return null;

      let mappedStatus: GatewayPaymentDetails['status'] = 'PENDING';
      if (order.order_status === 'PAID') mappedStatus = 'SUCCESS';
      else if (order.order_status === 'EXPIRED') mappedStatus = 'CANCELLED';

      return {
        paymentId: '',
        orderId: String(order.order_id || gatewayOrderId),
        status: mappedStatus,
        amount: Number(order.order_amount || 0),
        currency: String(order.order_currency || 'INR'),
        rawResponse: order,
      };
    } catch (err) {
      this.handleAxiosError(err, 'fetchPaymentStatus', gatewayOrderId);
    }
  }

  /**
   * Verifies Cashfree webhook signature using HMAC-SHA256.
   * Official Cashfree specification:
   * Signed payload = `${timestamp}${rawBody}`
   * Signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('base64')
   */
  async verifyWebhookSignature(
    params: WebhookVerificationParams,
  ): Promise<boolean> {
    const { signature, rawBody, timestamp } = params;

    if (!signature || !timestamp || rawBody === undefined || rawBody === null) {
      return false;
    }

    const credentials =
      params.credentialsOverride ||
      (await this.paymentConfigService.getCashfreeCredentials());
    if (!credentials && !params.secret) {
      this.logger.error('Cannot verify webhook signature: credentials missing');
      return false;
    }

    // Cashfree PG v2023-08-01 signs webhooks using the API secretKey.
    // If webhookSecret is configured, test both candidate secrets to ensure verification never breaks.
    const candidateSecrets: string[] = Array.from(
      new Set(
        [
          credentials?.secretKey,
          credentials?.webhookSecret,
          params.secret,
        ].filter(
          (s): s is string => typeof s === 'string' && s.trim().length > 0,
        ),
      ),
    );

    if (candidateSecrets.length === 0) {
      return false;
    }

    // Validate timestamp age to mitigate replay attacks (allow up to 10 minutes clock drift)
    const tsNum = Number(timestamp);
    if (!isNaN(tsNum)) {
      const tsMs = tsNum > 1e11 ? tsNum : tsNum * 1000;
      const ageMs = Math.abs(Date.now() - tsMs);
      if (ageMs > 10 * 60 * 1000) {
        this.logger.warn(
          `Rejected webhook signature with stale timestamp: ${timestamp}`,
        );
        return false;
      }
    }

    try {
      const signedPayload = `${timestamp}${rawBody}`;
      const actualBuffer = Buffer.from(signature, 'utf8');

      for (const secret of candidateSecrets) {
        const computedSignature = crypto
          .createHmac('sha256', secret)
          .update(signedPayload)
          .digest('base64');

        const expectedBuffer = Buffer.from(computedSignature, 'utf8');
        if (
          expectedBuffer.length === actualBuffer.length &&
          crypto.timingSafeEqual(expectedBuffer, actualBuffer)
        ) {
          return true;
        }
      }

      return false;
    } catch (err: any) {
      this.logger.error(`Webhook signature verification error: ${err.message}`);
      return false;
    }
  }

  /**
   * Normalizes Cashfree-specific webhook payload into standard Collects event.
   */
  parseWebhookPayload(
    rawBody: string,
    _headers?: Record<string, string>,
  ): NormalizedWebhookEvent {
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Malformed JSON webhook payload');
    }

    const orderId =
      payload.data?.order?.order_id ||
      payload.order?.order_id ||
      payload.orderId;

    if (!orderId) {
      throw new BadRequestException('Webhook payload missing order_id');
    }

    const rawStatus = (
      payload.data?.payment?.payment_status ||
      payload.payment?.payment_status ||
      payload.data?.order?.order_status ||
      payload.order?.order_status ||
      ''
    ).toUpperCase();

    let status: NormalizedWebhookEvent['status'] = 'PENDING';
    if (rawStatus === 'SUCCESS') status = 'SUCCESS';
    else if (['FAILED', 'CANCELLED'].includes(rawStatus)) status = 'FAILED';
    else if (rawStatus === 'USER_DROPPED') status = 'USER_DROPPED';
    else if (rawStatus === 'CANCELLED') status = 'CANCELLED';

    const gatewayPaymentId = payload.data?.payment?.cf_payment_id
      ? String(payload.data.payment.cf_payment_id)
      : payload.payment?.cf_payment_id
        ? String(payload.payment.cf_payment_id)
        : undefined;

    const amount =
      payload.data?.payment?.payment_amount != null
        ? Number(payload.data.payment.payment_amount)
        : payload.data?.order?.order_amount != null
          ? Number(payload.data.order.order_amount)
          : undefined;

    const currency =
      payload.data?.payment?.payment_currency ||
      payload.data?.order?.order_currency ||
      'INR';

    const eventTime = payload.event_time
      ? new Date(payload.event_time)
      : undefined;

    return {
      orderId,
      gatewayPaymentId,
      status,
      amount,
      currency,
      eventTime,
      rawEvent: payload,
    };
  }
}
