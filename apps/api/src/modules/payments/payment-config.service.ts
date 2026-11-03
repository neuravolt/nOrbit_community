import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { encrypt, decrypt, getEncryptionKey } from '@neuravolt/shared-utils';

export interface SafePaymentConfig {
  onlinePaymentEnabled: boolean;
  manualPaymentEnabled: boolean;
  activeOnlineGateway: 'CASHFREE';
  cashfreeEnvironment: 'sandbox' | 'production';
}

export interface CashfreeCredentials {
  appId: string;
  secretKey: string;
  environment: 'sandbox' | 'production';
  webhookSecret?: string;
}

export interface ResolvedGatewayAccount {
  accountId: string | null;
  provider: string;
  name: string;
  environment: 'sandbox' | 'production';
  credentials: CashfreeCredentials;
  isEnabled: boolean;
  isDefault: boolean;
}

export interface SafeGatewayAccount {
  id: string;
  provider: string;
  name: string;
  environment: 'sandbox' | 'production';
  appId: string;
  isConfigured: boolean;
  hasWebhookSecret: boolean;
  isEnabled: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGatewayAccountDto {
  provider: string;
  name: string;
  environment: 'sandbox' | 'production';
  appId: string;
  secretKey: string;
  webhookSecret?: string;
  isEnabled?: boolean;
  isDefault?: boolean;
}

export interface UpdateGatewayAccountDto {
  name?: string;
  appId?: string;
  secretKey?: string;
  webhookSecret?: string;
  isEnabled?: boolean;
  isDefault?: boolean;
}

@Injectable()
export class PaymentConfigService {
  private readonly logger = new Logger(PaymentConfigService.name);

  constructor(
    private readonly companyProfileService: CompanyProfileService,
    private readonly prisma: PrismaService,
  ) {}

  /**
    * Returns ONLY the safe, public configuration required by UI and Client Portal.
    * Never exposes credentials, secrets, or internal flags.
    */
  async getPaymentConfig(organizationId?: string | null): Promise<SafePaymentConfig> {
    const profile = await this.companyProfileService.get(organizationId);
    let onlinePaymentEnabled = profile.onlinePaymentEnabled ?? true;

    // Gracefully report onlinePaymentEnabled as false if Cashfree credentials are not configured
    if (onlinePaymentEnabled) {
      try {
        const creds = await this.getCashfreeCredentials(undefined, organizationId);
        if (!creds || !creds.appId || !creds.secretKey) {
          onlinePaymentEnabled = false;
        }
      } catch {
        onlinePaymentEnabled = false;
      }
    }

    const rawEnv = (
      process.env.CASHFREE_ENVIRONMENT ||
      profile.cashfreeEnvironment ||
      'sandbox'
    )
      .trim()
      .toLowerCase();
    const cashfreeEnvironment: 'sandbox' | 'production' =
      rawEnv === 'production' ? 'production' : 'sandbox';

    return {
      onlinePaymentEnabled,
      manualPaymentEnabled: profile.manualPaymentEnabled ?? true,
      activeOnlineGateway: 'CASHFREE',
      cashfreeEnvironment,
    };
  }

  /**
   * Resolves an authorized, active gateway account matching the provider and target environment.
   * Server-controlled selection policy:
   * 1. If explicit accountId is specified, verifies it is enabled, configured and matches environment.
   * 2. Checks PaymentGatewayAccount table for an active account matching (provider, environment, organizationId).
   * 3. Falls back gracefully to CompanyProfile / process.env Cashfree credentials (preserving 100% backward compatibility).
   */
  async resolveGatewayAccount(
    provider: string = 'CASHFREE',
    environment: 'sandbox' | 'production',
    accountId?: string,
    organizationId?: string | null,
  ): Promise<ResolvedGatewayAccount> {
    const normalizedProvider = (provider || 'CASHFREE').trim().toUpperCase();
    if (normalizedProvider === 'RAZORPAY') {
      throw new BadRequestException(
        'Razorpay is currently disabled in favor of Cashfree',
      );
    }

    // 1. If specific accountId requested, look it up strictly
    if (accountId) {
      const account = await this.prisma.paymentGatewayAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new NotFoundException(`Gateway account '${accountId}' not found`);
      }

      if (!account.isEnabled) {
        throw new BadRequestException(
          `Gateway account '${account.name}' is currently disabled`,
        );
      }

      if (account.provider !== provider) {
        throw new BadRequestException(
          `Gateway account provider mismatch: expected ${provider}, got ${account.provider}`,
        );
      }

      if (account.environment !== environment) {
        throw new BadRequestException(
          `Gateway account environment mismatch: account is ${account.environment}, requested ${environment}`,
        );
      }

      return this.formatResolvedAccount(account);
    }

    // 2. Query PaymentGatewayAccount table for enabled accounts matching provider & environment
    let account = null;
    if (organizationId) {
      account = await this.prisma.paymentGatewayAccount.findFirst({
        where: {
          provider,
          environment,
          isEnabled: true,
          organizationId,
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
    }

    if (!account) {
      account = await this.prisma.paymentGatewayAccount.findFirst({
        where: {
          provider,
          environment,
          isEnabled: true,
          organizationId: null,
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
    }

    if (account) {
      return this.formatResolvedAccount(account);
    }

    // 3. Fallback: Legacy credentials from CompanyProfile / process.env
    const legacyCreds = await this.getCashfreeCredentials(environment, organizationId);
    if (!legacyCreds || !legacyCreds.appId || !legacyCreds.secretKey) {
      throw new ServiceUnavailableException(
        `No active ${provider} gateway account is configured for ${environment} environment`,
      );
    }

    return {
      accountId: null,
      provider: 'CASHFREE',
      name: organizationId ? 'Tenant Cashfree Gateway' : 'Default NeuraVolt Merchant Account',
      environment,
      credentials: {
        appId: legacyCreds.appId,
        secretKey: legacyCreds.secretKey,
        environment,
        webhookSecret: legacyCreds.webhookSecret,
      },
      isEnabled: true,
      isDefault: true,
    };
  }

  // ── ADMIN GATEWAY ACCOUNTS CRUD ───────────────────────────────────────────

  async listGatewayAccounts(filter?: {
    provider?: string;
    environment?: string;
  }): Promise<SafeGatewayAccount[]> {
    const where: any = {};
    if (filter?.provider) where.provider = filter.provider.toUpperCase();
    if (filter?.environment)
      where.environment = filter.environment.toLowerCase();

    const accounts = await this.prisma.paymentGatewayAccount.findMany({
      where,
      orderBy: [
        { provider: 'asc' },
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return accounts.map((a) => ({
      id: a.id,
      provider: a.provider,
      name: a.name,
      environment: a.environment as 'sandbox' | 'production',
      appId: a.appId,
      isConfigured: Boolean(a.secretKeyEnc),
      hasWebhookSecret: Boolean(a.webhookSecretEnc),
      isEnabled: a.isEnabled,
      isDefault: a.isDefault,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));
  }

  async createGatewayAccount(
    dto: CreateGatewayAccountDto,
  ): Promise<SafeGatewayAccount> {
    if (dto.provider === 'RAZORPAY') {
      throw new BadRequestException(
        'Razorpay is currently disabled in favor of Cashfree',
      );
    }

    const env = dto.environment === 'production' ? 'production' : 'sandbox';
    const secretKeyEnc = encrypt(dto.secretKey.trim(), getEncryptionKey());
    const webhookSecretEnc = dto.webhookSecret
      ? encrypt(dto.webhookSecret.trim(), getEncryptionKey())
      : null;

    // If marked as default, unset other defaults for same (provider, environment)
    if (dto.isDefault) {
      await this.prisma.paymentGatewayAccount.updateMany({
        where: { provider: dto.provider, environment: env, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await this.prisma.paymentGatewayAccount.create({
      data: {
        provider: dto.provider,
        name: dto.name.trim(),
        environment: env,
        appId: dto.appId.trim(),
        secretKeyEnc,
        webhookSecretEnc,
        isEnabled: dto.isEnabled ?? true,
        isDefault: dto.isDefault ?? false,
      },
    });

    return {
      id: created.id,
      provider: created.provider,
      name: created.name,
      environment: created.environment as 'sandbox' | 'production',
      appId: created.appId,
      isConfigured: true,
      hasWebhookSecret: Boolean(created.webhookSecretEnc),
      isEnabled: created.isEnabled,
      isDefault: created.isDefault,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async updateGatewayAccount(
    id: string,
    dto: UpdateGatewayAccountDto,
  ): Promise<SafeGatewayAccount> {
    const existing = await this.prisma.paymentGatewayAccount.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Gateway account '${id}' not found`);
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.appId !== undefined) data.appId = dto.appId.trim();
    if (dto.isEnabled !== undefined) data.isEnabled = Boolean(dto.isEnabled);
    if (dto.secretKey) {
      data.secretKeyEnc = encrypt(dto.secretKey.trim(), getEncryptionKey());
    }
    if (dto.webhookSecret !== undefined) {
      data.webhookSecretEnc = dto.webhookSecret
        ? encrypt(dto.webhookSecret.trim(), getEncryptionKey())
        : null;
    }

    if (dto.isDefault) {
      await this.prisma.paymentGatewayAccount.updateMany({
        where: {
          provider: existing.provider,
          environment: existing.environment,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
      data.isDefault = true;
    } else if (dto.isDefault === false) {
      data.isDefault = false;
    }

    const updated = await this.prisma.paymentGatewayAccount.update({
      where: { id },
      data,
    });

    return {
      id: updated.id,
      provider: updated.provider,
      name: updated.name,
      environment: updated.environment as 'sandbox' | 'production',
      appId: updated.appId,
      isConfigured: Boolean(updated.secretKeyEnc),
      hasWebhookSecret: Boolean(updated.webhookSecretEnc),
      isEnabled: updated.isEnabled,
      isDefault: updated.isDefault,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteGatewayAccount(
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.paymentGatewayAccount.findUnique({
      where: { id },
      include: { _count: { select: { paymentAttempts: true } } },
    });

    if (!existing) {
      throw new NotFoundException(`Gateway account '${id}' not found`);
    }

    if (existing._count.paymentAttempts > 0) {
      throw new ConflictException(
        `Cannot delete gateway account with ${existing._count.paymentAttempts} historical payment transactions. Disable it instead.`,
      );
    }

    await this.prisma.paymentGatewayAccount.delete({ where: { id } });
    return { success: true, message: 'Gateway account deleted successfully' };
  }

  // ── LEGACY REUSABLE CREDENTIALS RESOLUTION ────────────────────────────────

  /**
   * Retrieves decrypted Cashfree credentials exclusively for trusted server-side execution.
   * Prioritizes process.env configuration, falling back to AES-256 decrypted DB fields.
   */
  async getCashfreeCredentials(
    targetEnv?: 'sandbox' | 'production',
    organizationId?: string | null,
  ): Promise<CashfreeCredentials | null> {
    const profile = await this.companyProfileService.get(organizationId);

    // 1. Resolve environment
    const rawEnv = (
      process.env.CASHFREE_ENVIRONMENT ||
      profile.cashfreeEnvironment ||
      'sandbox'
    )
      .trim()
      .toLowerCase();
    const environment: 'sandbox' | 'production' =
      targetEnv || (rawEnv === 'production' ? 'production' : 'sandbox');

    // 2. Resolve App ID
    let appId = '';
    if (organizationId) {
      appId = (
        (environment === 'production'
          ? profile.cashfreeProductionAppId || profile.cashfreeAppId
          : profile.cashfreeSandboxAppId || profile.cashfreeAppId) || ''
      ).trim();
    }
    if (!appId) {
      appId = (
        (environment === 'production'
          ? process.env.CASHFREE_APP_ID
          : process.env.CASHFREE_SANDBOX_APP_ID) ||
        (environment === 'production'
          ? profile.cashfreeProductionAppId || profile.cashfreeAppId
          : profile.cashfreeSandboxAppId || profile.cashfreeAppId) ||
        ''
      ).trim();
    }
    if (!appId) {
      return null;
    }

    // 3. Resolve Secret Key
    const secretKeyEnc =
      environment === 'production'
        ? profile.cashfreeProductionSecretKeyEnc ||
          (profile.cashfreeEnvironment === 'production'
            ? profile.cashfreeSecretKeyEnc
            : null)
        : profile.cashfreeSandboxSecretKeyEnc ||
          (!profile.cashfreeEnvironment ||
          profile.cashfreeEnvironment === 'sandbox'
            ? profile.cashfreeSecretKeyEnc
            : null);

    let secretKey = '';
    if (!organizationId) {
      secretKey = (
        (environment === 'production'
          ? process.env.CASHFREE_SECRET_KEY
          : process.env.CASHFREE_SANDBOX_SECRET_KEY || '') || ''
      ).trim();
    }
    if (!secretKey && secretKeyEnc) {
      try {
        const key = getEncryptionKey();
        const dec = decrypt(secretKeyEnc, key);
        if (dec) {
          secretKey = dec.trim();
        } else if (!secretKeyEnc.includes(':')) {
          secretKey = secretKeyEnc.trim();
        }
      } catch (err: any) {
        if (!secretKeyEnc.includes(':')) {
          secretKey = secretKeyEnc.trim();
        } else {
          this.logger.error('Failed to decrypt Cashfree secret key safely');
          return null;
        }
      }
    }
    if (!secretKey && organizationId) {
      secretKey = (
        (environment === 'production'
          ? process.env.CASHFREE_SECRET_KEY
          : process.env.CASHFREE_SANDBOX_SECRET_KEY || '') || ''
      ).trim();
    }
    if (!secretKey) {
      return null;
    }

    // 4. Resolve Webhook Secret (optional)
    const webhookSecretEnc =
      environment === 'production'
        ? profile.cashfreeProductionWebhookSecretEnc ||
          (profile.cashfreeEnvironment === 'production'
            ? profile.cashfreeWebhookSecretEnc
            : null)
        : profile.cashfreeSandboxWebhookSecretEnc ||
          (!profile.cashfreeEnvironment ||
          profile.cashfreeEnvironment === 'sandbox'
            ? profile.cashfreeWebhookSecretEnc
            : null);

    let webhookSecret: string | undefined;
    if (!organizationId) {
      webhookSecret = (
        (environment === 'production'
          ? process.env.CASHFREE_WEBHOOK_SECRET
          : process.env.CASHFREE_SANDBOX_WEBHOOK_SECRET || '') || ''
      ).trim();
    }
    if (!webhookSecret && webhookSecretEnc) {
      try {
        const key = getEncryptionKey();
        const dec = decrypt(webhookSecretEnc, key);
        if (dec) {
          webhookSecret = dec.trim();
        } else if (!webhookSecretEnc.includes(':')) {
          webhookSecret = webhookSecretEnc.trim();
        }
      } catch {
        if (!webhookSecretEnc.includes(':')) {
          webhookSecret = webhookSecretEnc.trim();
        }
      }
    }
    if (!webhookSecret && organizationId) {
      webhookSecret = (
        (environment === 'production'
          ? process.env.CASHFREE_WEBHOOK_SECRET
          : process.env.CASHFREE_SANDBOX_WEBHOOK_SECRET || '') || ''
      ).trim();
    }

    return {
      appId,
      secretKey,
      environment,
      ...(webhookSecret ? { webhookSecret } : {}),
    };
  }

  private formatResolvedAccount(account: any): ResolvedGatewayAccount {
    let secretKey: string = '';
    try {
      const key = getEncryptionKey();
      const dec = decrypt(account.secretKeyEnc, key);
      if (dec) {
        secretKey = dec;
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to decrypt credentials for gateway account '${account.id}': ${err.message}`,
      );
      throw new ServiceUnavailableException(
        `Gateway account credentials could not be decrypted safely`,
      );
    }

    if (!secretKey) {
      throw new ServiceUnavailableException(
        `Gateway account credentials decryption failed for '${account.name}'. Ensure ENCRYPTION_KEY is properly configured and credentials are encrypted.`,
      );
    }

    let webhookSecret: string | undefined;
    if (account.webhookSecretEnc) {
      try {
        const key = getEncryptionKey();
        const dec = decrypt(account.webhookSecretEnc, key);
        if (dec) {
          webhookSecret = dec;
        }
      } catch (err: any) {
        this.logger.warn(
          `Failed to decrypt webhook secret for account '${account.id}': ${err.message}`,
        );
      }
    }

    return {
      accountId: account.id,
      provider: account.provider,
      name: account.name,
      environment: account.environment as 'sandbox' | 'production',
      credentials: {
        appId: account.appId,
        secretKey,
        environment: account.environment as 'sandbox' | 'production',
        ...(webhookSecret ? { webhookSecret } : {}),
      },
      isEnabled: account.isEnabled,
      isDefault: account.isDefault,
    };
  }
}
