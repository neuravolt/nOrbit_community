import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CompanyProfileModule } from '../company-profile/company-profile.module';
import { PaymentConfigService } from './payment-config.service';
import { CashfreePaymentGateway } from './gateways/cashfree.gateway';
import { RazorpayPaymentGateway } from './gateways/razorpay.gateway';
import { PAYMENT_GATEWAY } from './gateways/payment-gateway.interface';

import { BillingModule } from '../billing/billing.module';
import { CollectsModule } from '../collects/collects.module';
import { PdfModule } from '../../common/pdf/pdf.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { AdminGatewayAccountsController } from './admin-gateway-accounts.controller';
import { PaymentGatewayRegistry } from './gateways/payment-gateway.registry';

@Global()
@Module({
  imports: [
    PrismaModule,
    CompanyProfileModule,
    BillingModule,
    CollectsModule,
    PdfModule,
  ],
  controllers: [PaymentsController, AdminGatewayAccountsController],
  providers: [
    PaymentConfigService,
    PaymentsService,
    PaymentGatewayRegistry,
    CashfreePaymentGateway,
    RazorpayPaymentGateway,
    {
      provide: PAYMENT_GATEWAY,
      useExisting: CashfreePaymentGateway,
    },
  ],
  exports: [
    PaymentConfigService,
    PaymentsService,
    PaymentGatewayRegistry,
    CashfreePaymentGateway,
    RazorpayPaymentGateway,
    PAYMENT_GATEWAY,
  ],
})
export class PaymentsModule {}
