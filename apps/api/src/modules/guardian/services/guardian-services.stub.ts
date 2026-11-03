import { Injectable } from '@nestjs/common';

@Injectable()
export class ExpiryReminderService {
  async listExpiries(_args: any): Promise<any[]> {
    return [];
  }
}

@Injectable()
export class GuardianPlanService {
  async getClientPlan(_clientId: string): Promise<any> {
    return 'COMMUNITY';
  }
  async clientAllows(_clientId: string, _feature: string): Promise<boolean> {
    return false;
  }
  async planForClient(_clientId: string): Promise<any> {
    return 'COMMUNITY';
  }
  async isAssetWithinPlanLimit(_asset: any, _plan?: any): Promise<boolean> {
    return false;
  }
  async effectiveLimitForClient(_clientId: string): Promise<any> {
    return { limit: 1 };
  }
  async assertClient(_clientId: string, _feature: string): Promise<boolean> {
    return true;
  }
}

@Injectable()
export class WebPushService {
  enabled = false;
  publicKey = null;
  async sendToUser(_userId: string, _payload: any): Promise<any> {
    return { sent: false };
  }
  async sendToClient(_clientId: string, _payload: any): Promise<any> {
    return { sent: false };
  }
  async countClient(_clientId: string): Promise<number> {
    return 0;
  }
  async subscribeClient(_clientId: string, _sub: any, _ua?: string): Promise<any> {
    return { ok: true };
  }
  async unsubscribeClient(_clientId: string, _endpoint: string): Promise<any> {
    return { ok: true };
  }
}

@Injectable()
export class TelegramService {
  enabled = false;
  async send(_to: any, _text: string): Promise<boolean> {
    return false;
  }
}

@Injectable()
export class WordPressSecurityScanService {
  async scanAgent(_agentId: string): Promise<any> {
    return { status: 'ENTERPRISE_ONLY' };
  }
  async quarantineWordPressFile(..._args: any[]): Promise<any> {
    return { status: 'ENTERPRISE_ONLY' };
  }
  async getQuarantineRegistry(..._args: any[]): Promise<any> {
    return [];
  }
  async getQuarantineRecord(..._args: any[]): Promise<any> {
    return null;
  }
  async restoreWordPressFile(..._args: any[]): Promise<any> {
    return { status: 'ENTERPRISE_ONLY' };
  }
}
