import { Global, Module } from '@nestjs/common';
import { AdminPlansController } from './admin-plans.controller';
import { AdminOrganizationsController } from './admin-organizations.controller';
import { CustomerPlansController } from './customer-plans.controller';
import { PlansService } from './plans.service';
import { SubscriptionsService } from './subscriptions.service';
import { PlansEnforcementService } from './plans-enforcement.service';

@Global()
@Module({
  controllers: [
    AdminPlansController,
    AdminOrganizationsController,
    CustomerPlansController,
  ],
  providers: [PlansService, SubscriptionsService, PlansEnforcementService],
  exports: [PlansService, SubscriptionsService, PlansEnforcementService],
})
export class PlansModule {}
