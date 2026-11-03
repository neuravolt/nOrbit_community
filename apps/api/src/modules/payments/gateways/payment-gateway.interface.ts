export enum PaymentCapability {
  ONE_TIME_PAYMENT = 'ONE_TIME_PAYMENT',
  RECURRING_SUBSCRIPTION = 'RECURRING_SUBSCRIPTION',
  UPI_AUTOPAY = 'UPI_AUTOPAY',
  REFUNDS = 'REFUNDS',
}

export interface CreatePaymentOrderInput {
  orderId: string;
  amount: number;
  currency: 'INR' | string;
  customer: {
    id: string;
    phone: string;
    email?: string;
    name?: string;
  };
  returnUrl?: string;
  notifyUrl?: string;
  orderNote?: string;
  orderTags?: Record<string, string>;
  idempotencyKey?: string;
  credentials?: any;
}

export interface GatewayOrderResult {
  gatewayOrderId: string;
  paymentSessionId?: string;
  orderStatus: string;
  rawResponse?: Record<string, any>;
}

export interface GatewayPaymentDetails {
  paymentId: string;
  orderId: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'USER_DROPPED' | 'CANCELLED';
  amount: number;
  currency: string;
  paymentTime?: Date;
  paymentMethod?: string;
  bankReference?: string;
  rawResponse?: Record<string, any>;
}

export interface WebhookVerificationParams {
  signature: string;
  rawBody: string;
  timestamp?: string;
  secret?: string;
  credentialsOverride?: any;
}

export interface NormalizedWebhookEvent {
  orderId: string;
  gatewayPaymentId?: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'USER_DROPPED' | 'CANCELLED';
  amount?: number;
  currency?: string;
  eventTime?: Date;
  rawEvent?: Record<string, any>;
}

export interface IPaymentGateway {
  readonly gatewayName: string;

  /**
   * Returns list of capabilities implemented and verified for this gateway adapter.
   */
  getSupportedCapabilities(): PaymentCapability[];

  /**
   * Explicit capability check.
   */
  supportsCapability(capability: PaymentCapability): boolean;

  /**
   * Creates an order/session in the payment gateway.
   * Higher-level services must validate amounts and ownership before calling this.
   */
  createOrder(input: CreatePaymentOrderInput): Promise<GatewayOrderResult>;

  /**
   * Fetches latest payment/order status directly from the gateway API.
   */
  fetchPaymentStatus(
    gatewayOrderId: string,
    credentialsOverride?: any,
  ): Promise<GatewayPaymentDetails | null>;

  /**
   * Verifies an incoming webhook request signature using the gateway's signing specification.
   */
  verifyWebhookSignature(params: WebhookVerificationParams): Promise<boolean>;

  /**
   * Normalizes provider-specific webhook payload into standard Collects event.
   */
  parseWebhookPayload(
    rawBody: string,
    headers?: Record<string, string>,
  ): NormalizedWebhookEvent;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
