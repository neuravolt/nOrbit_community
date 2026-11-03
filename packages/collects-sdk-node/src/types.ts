export interface CollectsClientOptions {
  appId: string;
  apiKey: string;
  baseUrl?: string;
  environment?: 'TEST' | 'LIVE';
  timeoutMs?: number;
}

export interface CollectCustomer {
  id?: string;
  phone: string;
  email?: string;
  name?: string;
}

export interface CreateCheckoutSessionParams {
  orderId: string;
  amount: string; // e.g. "999.00"
  currency: 'INR';
  customer: CollectCustomer;
  metadata?: Record<string, string | number | boolean | null | Record<string, string | number | boolean | null>>;
}

export interface CheckoutSessionResponse {
  paymentSessionId: string;
  gatewayOrderId: string;
  orderId: string;
  amount: string;
  currency: 'INR';
  environment: 'TEST' | 'LIVE';
  expiresAt: string;
}
