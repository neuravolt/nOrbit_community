import { Injectable, ForbiddenException } from '@nestjs/common';
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
export class RazorpayPaymentGateway implements IPaymentGateway {
  readonly gatewayName = 'RAZORPAY';

  getSupportedCapabilities(): PaymentCapability[] {
    // Razorpay is currently disabled in favor of Cashfree; declares no active capabilities
    return [];
  }

  supportsCapability(_capability: PaymentCapability): boolean {
    return false;
  }

  async createOrder(
    _input: CreatePaymentOrderInput,
  ): Promise<GatewayOrderResult> {
    throw new ForbiddenException('Razorpay is disabled in favor of Cashfree.');
  }

  async fetchPaymentStatus(
    _gatewayOrderId: string,
  ): Promise<GatewayPaymentDetails | null> {
    throw new ForbiddenException('Razorpay is disabled in favor of Cashfree.');
  }

  async verifyWebhookSignature(
    _params: WebhookVerificationParams,
  ): Promise<boolean> {
    throw new ForbiddenException('Razorpay is disabled in favor of Cashfree.');
  }

  parseWebhookPayload(
    _rawBody: string,
    _headers?: Record<string, string>,
  ): NormalizedWebhookEvent {
    throw new ForbiddenException('Razorpay is disabled in favor of Cashfree.');
  }
}
