import { Module } from '@nestjs/common';
import { GuardianService } from './guardian.service';
import {
  ExpiryReminderService,
  GuardianPlanService,
  WebPushService,
  TelegramService,
  WordPressSecurityScanService,
} from './services/guardian-services.stub';

@Module({
  providers: [
    GuardianService,
    ExpiryReminderService,
    GuardianPlanService,
    WebPushService,
    TelegramService,
    WordPressSecurityScanService,
  ],
  exports: [
    GuardianService,
    ExpiryReminderService,
    GuardianPlanService,
    WebPushService,
    TelegramService,
    WordPressSecurityScanService,
  ],
})
export class GuardianModule {}
