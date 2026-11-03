import { Injectable } from '@nestjs/common';

@Injectable()
export class GuardianService {
  async getDashboardOverview() {
    return {
      message: 'Guardian Autonomous SRE is an enterprise cloud capability. Please visit norbit.neuravolt.in to learn more.',
      status: 'ENTERPRISE_ONLY',
    };
  }

  async triggerMalwareScan(_agentId: string) {
    return { status: 'ENTERPRISE_ONLY' };
  }

  async triggerSecurityScan(_agentId: string) {
    return { status: 'ENTERPRISE_ONLY' };
  }

  async generateInstallToken(_args: any) {
    return { token: 'enterprise-only-token' };
  }
}
