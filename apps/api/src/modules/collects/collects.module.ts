import { Module } from '@nestjs/common';
import { CollectWalletService, CollectWebhookService } from './services/collect-wallet.service';

@Module({
  providers: [CollectWalletService, CollectWebhookService],
  exports: [CollectWalletService, CollectWebhookService],
})
export class CollectsModule {}
