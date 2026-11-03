import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { IPaymentGateway } from './payment-gateway.interface';
import { CashfreePaymentGateway } from './cashfree.gateway';
import { RazorpayPaymentGateway } from './razorpay.gateway';

@Injectable()
export class PaymentGatewayRegistry {
  private readonly logger = new Logger(PaymentGatewayRegistry.name);
  private readonly gateways = new Map<string, IPaymentGateway>();

  constructor(
    private readonly cashfreeGateway: CashfreePaymentGateway,
    private readonly razorpayGateway: RazorpayPaymentGateway,
  ) {
    this.registerGateway(this.cashfreeGateway);
    this.registerGateway(this.razorpayGateway);
  }

  /**
   * Registers a payment gateway adapter.
   */
  registerGateway(gateway: IPaymentGateway): void {
    const key = gateway.gatewayName.toUpperCase();
    this.gateways.set(key, gateway);
    this.logger.log(`Registered payment gateway adapter: ${key}`);
  }

  /**
   * Unregisters a payment gateway adapter (useful for isolating test adapters).
   */
  unregisterGateway(gatewayName: string): void {
    this.gateways.delete(gatewayName.toUpperCase());
  }

  /**
   * Resolves a registered gateway adapter by its provider name.
   */
  getGateway(provider: string): IPaymentGateway {
    const key = (provider || '').trim().toUpperCase();
    const gateway = this.gateways.get(key);
    if (!gateway) {
      throw new NotFoundException(
        `Payment gateway provider '${provider}' is not registered in NeuraVolt Collects`,
      );
    }
    return gateway;
  }

  /**
   * Checks whether a gateway provider is registered.
   */
  hasGateway(provider: string): boolean {
    return this.gateways.has((provider || '').trim().toUpperCase());
  }

  /**
   * Returns list of registered provider names.
   */
  listRegisteredGateways(): string[] {
    return Array.from(this.gateways.keys());
  }
}
