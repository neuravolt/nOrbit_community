import { Test, TestingModule } from '@nestjs/testing';
import {
  PaymentConfigService,
  SafePaymentConfig,
} from '../payment-config.service';
import { CompanyProfileService } from '../../company-profile/company-profile.service';
import { encrypt, getEncryptionKey } from '@neuravolt/shared-utils';

import { PrismaService } from '../../../common/prisma/prisma.service';

describe('Phase 2: PaymentConfigService Unit & Security Tests', () => {
  let service: PaymentConfigService;
  let mockCompanyProfileService: {
    get: jest.Mock;
  };
  let mockPrisma: any;

  const key = getEncryptionKey();

  beforeEach(async () => {
    mockCompanyProfileService = {
      get: jest.fn(),
    };

    mockPrisma = {
      paymentGatewayAccount: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentConfigService,
        {
          provide: CompanyProfileService,
          useValue: mockCompanyProfileService,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PaymentConfigService>(PaymentConfigService);

    // Clean up test env variables between runs
    delete process.env.CASHFREE_APP_ID;
    delete process.env.CASHFREE_SECRET_KEY;
    delete process.env.CASHFREE_ENVIRONMENT;
    delete process.env.CASHFREE_WEBHOOK_SECRET;
  });

  describe('Central Payment Configuration (getPaymentConfig)', () => {
    it('should return online ON and manual ON when both are enabled in DB', async () => {
      mockCompanyProfileService.get.mockResolvedValue({
        onlinePaymentEnabled: true,
        manualPaymentEnabled: true,
        activeOnlineGateway: 'CASHFREE',
        cashfreeAppId: 'CF_APP_123',
        cashfreeSecretKeyEnc: encrypt('cf_secret_val', key),
      });

      const config: SafePaymentConfig = await service.getPaymentConfig();

      expect(config).toEqual({
        onlinePaymentEnabled: true,
        manualPaymentEnabled: true,
        activeOnlineGateway: 'CASHFREE',
        cashfreeEnvironment: 'sandbox',
      });
    });

    it('should return online OFF when onlinePaymentEnabled is false', async () => {
      mockCompanyProfileService.get.mockResolvedValue({
        onlinePaymentEnabled: false,
        manualPaymentEnabled: true,
        activeOnlineGateway: 'CASHFREE',
      });

      const config = await service.getPaymentConfig();
      expect(config.onlinePaymentEnabled).toBe(false);
      expect(config.manualPaymentEnabled).toBe(true);
      expect(config.activeOnlineGateway).toBe('CASHFREE');
    });

    it('should return manual OFF when manualPaymentEnabled is false', async () => {
      mockCompanyProfileService.get.mockResolvedValue({
        onlinePaymentEnabled: true,
        manualPaymentEnabled: false,
        activeOnlineGateway: 'CASHFREE',
        cashfreeAppId: 'CF_APP_123',
        cashfreeSecretKeyEnc: encrypt('cf_secret', key),
      });

      const config = await service.getPaymentConfig();
      expect(config.onlinePaymentEnabled).toBe(true);
      expect(config.manualPaymentEnabled).toBe(false);
      expect(config.activeOnlineGateway).toBe('CASHFREE');
    });

    it('should gracefully report onlinePaymentEnabled as false if Cashfree credentials are missing', async () => {
      mockCompanyProfileService.get.mockResolvedValue({
        onlinePaymentEnabled: true,
        manualPaymentEnabled: true,
        activeOnlineGateway: 'CASHFREE',
        cashfreeAppId: null,
        cashfreeSecretKeyEnc: null,
      });

      const config = await service.getPaymentConfig();
      expect(config.onlinePaymentEnabled).toBe(false);
      expect(config.manualPaymentEnabled).toBe(true);
      expect(config.activeOnlineGateway).toBe('CASHFREE');
    });

    it('should handle both OFF properly', async () => {
      mockCompanyProfileService.get.mockResolvedValue({
        onlinePaymentEnabled: false,
        manualPaymentEnabled: false,
        activeOnlineGateway: 'CASHFREE',
      });

      const config = await service.getPaymentConfig();
      expect(config.onlinePaymentEnabled).toBe(false);
      expect(config.manualPaymentEnabled).toBe(false);
      expect(config.activeOnlineGateway).toBe('CASHFREE');
    });

    it('should ALWAYS enforce activeOnlineGateway as CASHFREE even if DB has RAZORPAY or other legacy values', async () => {
      mockCompanyProfileService.get.mockResolvedValue({
        onlinePaymentEnabled: true,
        manualPaymentEnabled: true,
        activeOnlineGateway: 'RAZORPAY', // Malicious or stale DB value
        paymentGateway: 'RAZORPAY',
      });

      const config = await service.getPaymentConfig();
      // Must be strictly locked to CASHFREE
      expect(config.activeOnlineGateway).toBe('CASHFREE');
      expect((config as any).paymentGateway).toBeUndefined();
    });

    it('public response MUST NEVER contain any secrets, API keys, or encrypted ciphertexts', async () => {
      mockCompanyProfileService.get.mockResolvedValue({
        onlinePaymentEnabled: true,
        manualPaymentEnabled: true,
        activeOnlineGateway: 'CASHFREE',
        cashfreeAppId: 'CF_TOP_SECRET_APP_ID',
        cashfreeSecretKeyEnc: 'enc_secret_ciphertext_here',
        cashfreeWebhookSecretEnc: 'enc_webhook_ciphertext_here',
        razorpayKeyId: 'rzp_key_secret',
        razorpayKeySecretEnc: 'rzp_secret_ciphertext_here',
      });

      const config = await service.getPaymentConfig();
      const keys = Object.keys(config);

      // Verify exact shape: ONLY these 4 fields allowed (cashfreeEnvironment is a mode label,
      // not a secret — safe to expose so the client SDK never has to hardcode 'sandbox')
      expect(keys.sort()).toEqual([
        'activeOnlineGateway',
        'cashfreeEnvironment',
        'manualPaymentEnabled',
        'onlinePaymentEnabled',
      ]);

      expect((config as any).cashfreeAppId).toBeUndefined();
      expect((config as any).cashfreeSecretKeyEnc).toBeUndefined();
      expect((config as any).cashfreeWebhookSecretEnc).toBeUndefined();
      expect((config as any).razorpayKeyId).toBeUndefined();
      expect((config as any).razorpayKeySecretEnc).toBeUndefined();
    });

    it('should expose cashfreeEnvironment as production when CASHFREE_ENVIRONMENT=production, regardless of DB value', async () => {
      process.env.CASHFREE_ENVIRONMENT = 'production';
      mockCompanyProfileService.get.mockResolvedValue({
        onlinePaymentEnabled: true,
        manualPaymentEnabled: true,
        activeOnlineGateway: 'CASHFREE',
        cashfreeAppId: 'CF_APP_123',
        cashfreeSecretKeyEnc: encrypt('cf_secret_val', key),
        cashfreeEnvironment: 'sandbox',
      });

      const config = await service.getPaymentConfig();
      expect(config.cashfreeEnvironment).toBe('production');
    });

    it('should default cashfreeEnvironment to sandbox when nothing is configured', async () => {
      mockCompanyProfileService.get.mockResolvedValue({
        onlinePaymentEnabled: false,
        manualPaymentEnabled: true,
        activeOnlineGateway: 'CASHFREE',
      });

      const config = await service.getPaymentConfig();
      expect(config.cashfreeEnvironment).toBe('sandbox');
    });
  });

  describe('Secure Server-side Credential Retrieval (getCashfreeCredentials)', () => {
    it('should decrypt credentials securely from database when present', async () => {
      const rawSecret = 'cf_sec_live_999988887777';
      const rawWebhookSecret = 'wh_sec_555544443333';

      mockCompanyProfileService.get.mockResolvedValue({
        cashfreeAppId: 'CF_APP_DB_123',
        cashfreeSecretKeyEnc: encrypt(rawSecret, key),
        cashfreeWebhookSecretEnc: encrypt(rawWebhookSecret, key),
        cashfreeEnvironment: 'sandbox',
      });

      const creds = await service.getCashfreeCredentials();
      expect(creds).toBeDefined();
      expect(creds?.appId).toBe('CF_APP_DB_123');
      expect(creds?.secretKey).toBe(rawSecret);
      expect(creds?.environment).toBe('sandbox');
      expect(creds?.webhookSecret).toBe(rawWebhookSecret);
    });

    it('should prioritize environment variables over database values', async () => {
      process.env.CASHFREE_APP_ID = 'CF_ENV_APP_OVERRIDE';
      process.env.CASHFREE_SECRET_KEY = 'cf_env_sec_override';
      process.env.CASHFREE_ENVIRONMENT = 'production';
      process.env.CASHFREE_WEBHOOK_SECRET = 'cf_env_webhook_override';

      mockCompanyProfileService.get.mockResolvedValue({
        cashfreeAppId: 'CF_DB_APP_SHOULD_BE_IGNORED',
        cashfreeSecretKeyEnc: encrypt('db_secret_ignored', key),
        cashfreeEnvironment: 'sandbox',
      });

      const creds = await service.getCashfreeCredentials();
      expect(creds).toBeDefined();
      expect(creds?.appId).toBe('CF_ENV_APP_OVERRIDE');
      expect(creds?.secretKey).toBe('cf_env_sec_override');
      expect(creds?.environment).toBe('production');
      expect(creds?.webhookSecret).toBe('cf_env_webhook_override');
    });

    it('should return null safely without throwing if App ID is missing', async () => {
      mockCompanyProfileService.get.mockResolvedValue({
        cashfreeAppId: null,
        cashfreeSecretKeyEnc: encrypt('some_secret', key),
        cashfreeEnvironment: 'sandbox',
      });

      const creds = await service.getCashfreeCredentials();
      expect(creds).toBeNull();
    });

    it('should return null safely without throwing if Secret Key is missing', async () => {
      mockCompanyProfileService.get.mockResolvedValue({
        cashfreeAppId: 'CF_APP_123',
        cashfreeSecretKeyEnc: null,
        cashfreeEnvironment: 'sandbox',
      });

      const creds = await service.getCashfreeCredentials();
      expect(creds).toBeNull();
    });

    it('should handle invalid ciphertext or decryption error safely without leaking secrets or crashing', async () => {
      mockCompanyProfileService.get.mockResolvedValue({
        cashfreeAppId: 'CF_APP_123',
        cashfreeSecretKeyEnc: 'invalid_malformed_ciphertext_12345',
        cashfreeEnvironment: 'sandbox',
      });

      const creds = await service.getCashfreeCredentials();
      expect(creds).toBeNull();
    });
  });

  describe('Multi-Account & Server-Controlled Gateway Resolution', () => {
    it('resolves enabled account from PaymentGatewayAccount table with decrypted secret', async () => {
      mockPrisma.paymentGatewayAccount.findFirst.mockResolvedValue({
        id: 'acc-prod-1',
        provider: 'CASHFREE',
        name: 'Primary Cashfree Production',
        environment: 'production',
        appId: 'CF_PROD_APP',
        secretKeyEnc: encrypt('cf_prod_secret', key),
        webhookSecretEnc: encrypt('cf_prod_wh_secret', key),
        isEnabled: true,
        isDefault: true,
      });

      const resolved = await service.resolveGatewayAccount(
        'CASHFREE',
        'production',
      );
      expect(resolved.accountId).toBe('acc-prod-1');
      expect(resolved.credentials.appId).toBe('CF_PROD_APP');
      expect(resolved.credentials.secretKey).toBe('cf_prod_secret');
      expect(resolved.credentials.webhookSecret).toBe('cf_prod_wh_secret');
      expect(resolved.environment).toBe('production');
    });

    it('enforces TEST / LIVE environment isolation: sandbox account is resolved for sandbox environment', async () => {
      mockPrisma.paymentGatewayAccount.findFirst.mockResolvedValue({
        id: 'acc-sand-1',
        provider: 'CASHFREE',
        name: 'Cashfree Sandbox Test',
        environment: 'sandbox',
        appId: 'CF_TEST_APP',
        secretKeyEnc: encrypt('cf_test_secret', key),
        webhookSecretEnc: null,
        isEnabled: true,
        isDefault: true,
      });

      const resolved = await service.resolveGatewayAccount(
        'CASHFREE',
        'sandbox',
      );
      expect(resolved.accountId).toBe('acc-sand-1');
      expect(resolved.credentials.appId).toBe('CF_TEST_APP');
      expect(resolved.environment).toBe('sandbox');
    });

    it('rejects disabled accounts when resolved by explicit accountId', async () => {
      mockPrisma.paymentGatewayAccount.findUnique.mockResolvedValue({
        id: 'acc-disabled',
        provider: 'CASHFREE',
        name: 'Disabled Account',
        environment: 'production',
        isEnabled: false,
      });

      await expect(
        service.resolveGatewayAccount('CASHFREE', 'production', 'acc-disabled'),
      ).rejects.toThrow(/disabled/);
    });

    it('gracefully falls back to legacy CompanyProfile credentials when no accounts exist in table', async () => {
      mockPrisma.paymentGatewayAccount.findFirst.mockResolvedValue(null);
      mockCompanyProfileService.get.mockResolvedValue({
        cashfreeAppId: 'CF_LEGACY_APP',
        cashfreeSecretKeyEnc: encrypt('cf_legacy_secret', key),
        cashfreeEnvironment: 'production',
      });

      const resolved = await service.resolveGatewayAccount(
        'CASHFREE',
        'production',
      );
      expect(resolved.accountId).toBeNull();
      expect(resolved.credentials.appId).toBe('CF_LEGACY_APP');
      expect(resolved.credentials.secretKey).toBe('cf_legacy_secret');
      expect(resolved.isDefault).toBe(true);
    });

    it('encrypts secretKey and webhookSecret using AES-256-GCM before persisting on createGatewayAccount', async () => {
      mockPrisma.paymentGatewayAccount.create.mockImplementation(
        (args: any) => ({
          id: 'acc-new-1',
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const res = await service.createGatewayAccount({
        provider: 'CASHFREE',
        name: 'New Test Account',
        environment: 'sandbox',
        appId: 'CF_RAW_APP_ID',
        secretKey: 'my_super_secret_raw_key',
        webhookSecret: 'my_raw_webhook_secret',
      });

      // Verify Prisma received encrypted strings (with 3 parts: iv:tag:cipher)
      expect(mockPrisma.paymentGatewayAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          appId: 'CF_RAW_APP_ID',
          secretKeyEnc: expect.stringMatching(
            /^[a-f0-9]{24}:[a-f0-9]{32}:[a-f0-9]+$/,
          ),
          webhookSecretEnc: expect.stringMatching(
            /^[a-f0-9]{24}:[a-f0-9]{32}:[a-f0-9]+$/,
          ),
        }),
      });

      // Verify returned safe DTO masks all secrets
      expect(res).toEqual(
        expect.objectContaining({
          id: 'acc-new-1',
          name: 'New Test Account',
          appId: 'CF_RAW_APP_ID',
          isConfigured: true,
          hasWebhookSecret: true,
        }),
      );
      expect((res as any).secretKey).toBeUndefined();
      expect((res as any).secretKeyEnc).toBeUndefined();
      expect((res as any).webhookSecret).toBeUndefined();
      expect((res as any).webhookSecretEnc).toBeUndefined();
    });

    it('masks secrets in listGatewayAccounts and updateGatewayAccount', async () => {
      mockPrisma.paymentGatewayAccount.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          provider: 'CASHFREE',
          name: 'Prod Acc',
          environment: 'production',
          appId: 'CF_APP',
          secretKeyEnc: 'encrypted_sec',
          webhookSecretEnc: 'encrypted_wh',
          isEnabled: true,
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const list = await service.listGatewayAccounts();
      expect(list[0]).toEqual(
        expect.objectContaining({
          id: 'acc-1',
          appId: 'CF_APP',
          isConfigured: true,
          hasWebhookSecret: true,
        }),
      );
      expect((list[0] as any).secretKey).toBeUndefined();
      expect((list[0] as any).secretKeyEnc).toBeUndefined();

      mockPrisma.paymentGatewayAccount.findUnique.mockResolvedValue({
        id: 'acc-1',
        provider: 'CASHFREE',
        environment: 'production',
      });
      mockPrisma.paymentGatewayAccount.update.mockResolvedValue({
        id: 'acc-1',
        provider: 'CASHFREE',
        name: 'Updated Name',
        environment: 'production',
        appId: 'CF_APP',
        secretKeyEnc: 'new_enc',
        webhookSecretEnc: null,
        isEnabled: true,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updated = await service.updateGatewayAccount('acc-1', {
        name: 'Updated Name',
        secretKey: 'new_secret',
      });

      expect(updated.isConfigured).toBe(true);
      expect(updated.hasWebhookSecret).toBe(false);
      expect((updated as any).secretKey).toBeUndefined();
      expect((updated as any).secretKeyEnc).toBeUndefined();
    });

    it('fails with ServiceUnavailableException when secret cannot be decrypted', async () => {
      // Encrypt with a different key so decryption with current key fails
      const wrongKey = 'b'.repeat(64);
      const corruptedSecret = encrypt('my_secret', wrongKey);

      mockPrisma.paymentGatewayAccount.findFirst.mockResolvedValue({
        id: 'acc-corrupted',
        provider: 'CASHFREE',
        name: 'Corrupted Account',
        environment: 'production',
        appId: 'CF_APP',
        secretKeyEnc: corruptedSecret,
        isEnabled: true,
      });

      await expect(
        service.resolveGatewayAccount('CASHFREE', 'production'),
      ).rejects.toThrow(/Gateway account credentials decryption failed/);
    });

    it('strictly rejects unencrypted plaintext credentials in PaymentGatewayAccount rather than silently accepting them', async () => {
      // Legacy record with raw unencrypted string (no colons)
      mockPrisma.paymentGatewayAccount.findFirst.mockResolvedValue({
        id: 'acc-legacy',
        provider: 'CASHFREE',
        name: 'Legacy Unencrypted Account',
        environment: 'production',
        appId: 'CF_LEGACY_APP',
        secretKeyEnc: 'raw_legacy_secret_without_encryption',
        webhookSecretEnc: 'raw_legacy_wh_secret',
        isEnabled: true,
        isDefault: true,
      });

      await expect(
        service.resolveGatewayAccount('CASHFREE', 'production'),
      ).rejects.toThrow(/Gateway account credentials decryption failed/);
    });

    it('enforces cross-provider and cross-environment isolation', async () => {
      mockPrisma.paymentGatewayAccount.findUnique.mockResolvedValue({
        id: 'acc-sandbox-1',
        provider: 'CASHFREE',
        name: 'Sandbox Account',
        environment: 'sandbox',
        isEnabled: true,
      });

      // Requesting production environment with sandbox account must be rejected
      await expect(
        service.resolveGatewayAccount(
          'CASHFREE',
          'production',
          'acc-sandbox-1',
        ),
      ).rejects.toThrow(/environment mismatch/);

      // Requesting RAZORPAY must be rejected
      await expect(
        service.resolveGatewayAccount('RAZORPAY', 'sandbox', 'acc-sandbox-1'),
      ).rejects.toThrow(/disabled in favor of Cashfree/);
    });

    it('prevents deleting an account with historical payment transactions', async () => {
      mockPrisma.paymentGatewayAccount.findUnique.mockResolvedValue({
        id: 'acc-with-history',
        _count: { paymentAttempts: 4 },
      });

      await expect(
        service.deleteGatewayAccount('acc-with-history'),
      ).rejects.toThrow(
        /Cannot delete gateway account with 4 historical payment transactions/,
      );
    });
  });
});
