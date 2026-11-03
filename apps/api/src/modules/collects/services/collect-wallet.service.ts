import { Injectable } from '@nestjs/common';

@Injectable()
export class CollectWalletService {
  async credit(_args: any) {
    return { ok: true };
  }
  async creditPaymentInTx(..._args: any[]) {
    return { ok: true };
  }
}

@Injectable()
export class CollectWebhookService {
  async handleWebhook(_args: any) {
    return { ok: true };
  }
  async queueWebhookDelivery(..._args: any[]) {
    return { ok: true };
  }
}
