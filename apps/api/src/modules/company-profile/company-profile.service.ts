import { Injectable, BadRequestException } from '@nestjs/common';
import { encrypt, decrypt, getEncryptionKey } from '@neuravolt/shared-utils';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpsertCompanyProfileDto } from './dto/upsert-company-profile.dto';

@Injectable()
export class CompanyProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private getEncryptionKey(): string {
    return getEncryptionKey();
  }

  /** Decrypted Razorpay credentials for internal (server-side only) use. Never expose the secret to any client response. */
  async getRazorpayCredentials(organizationId?: string | null): Promise<{
    keyId: string;
    keySecret: string;
  } | null> {
    const profile = await this.get(organizationId);
    if (
      profile.paymentGateway !== 'RAZORPAY' ||
      !profile.razorpayKeyId ||
      !profile.razorpayKeySecretEnc
    ) {
      return null;
    }
    return {
      keyId: profile.razorpayKeyId,
      keySecret: decrypt(profile.razorpayKeySecretEnc, this.getEncryptionKey()),
    };
  }

  async get(organizationId?: string | null) {
    if (organizationId) {
      const orgProfile = await this.prisma.companyProfile.findUnique({
        where: { organizationId },
      });
      if (orgProfile) return orgProfile;

      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
      });
      const orgName = org?.name || 'Company Workspace';

      return this.prisma.companyProfile.create({
        data: {
          organizationId,
          companyName: orgName,
          legalName: orgName,
          tagline: '',
          address: '',
          city: '',
          state: '',
          zip: '',
          country: 'India',
          phone: '',
          email: '',
          website: '',
          defaultCurrency: 'INR',
          defaultPaymentTerms: 30,
          defaultGstRate: 18,
          invoicePrefix: 'INV-',
          quotePrefix: 'QUO-',
          amcPrefix: 'AMC-',
          amcReportPrefix: 'REP-',
          invoiceTerms:
            'Payment is due within the terms specified on the invoice.',
          quoteTerms:
            'This quotation is valid for 30 days from the date of issue.',
          amcTerms:
            'AMC hours must be consumed within the contract cycle.',
        },
      });
    }

    const internalProfile = await this.prisma.companyProfile.findFirst({
      where: { organizationId: null },
    });
    if (internalProfile) return internalProfile;

    const anyProfile = await this.prisma.companyProfile.findFirst();
    if (anyProfile) return anyProfile;

    // Return sensible defaults if no profile exists yet
    return this.prisma.companyProfile.create({
      data: {
        organizationId: null,
        companyName: 'NeuraVolt Technology',
        legalName: 'NeuraVolt Technology Pvt Ltd',
        tagline: 'Powering Autonomous Operations',
        address: '',
        city: 'Hyderabad',
        state: 'Telangana',
        zip: '500081',
        country: 'India',
        phone: '', // set the real number in Settings → Company Profile; empty is hidden in emails
        email: 'info@neuravolt.com',
        website: 'https://neuravolt.com',
        defaultCurrency: 'INR',
        defaultPaymentTerms: 30,
        defaultGstRate: 18,
        invoicePrefix: 'INV-',
        quotePrefix: 'QUO-',
        amcPrefix: 'AMC-',
        amcReportPrefix: 'REP-',
        invoiceTerms:
          'Payment is due within the terms specified on the invoice. Interest of 18% per annum will be charged on overdue payments.',
        quoteTerms:
          'This quotation is valid for 30 days from the date of issue. Technical execution begins upon 50% milestone payment.',
        amcTerms:
          'AMC hours must be consumed within the contract cycle. Unused hours do not roll over to next year.',
      },
    });
  }

  async upsert(dto: UpsertCompanyProfileDto, organizationId?: string | null) {
    if (dto.activeOnlineGateway && dto.activeOnlineGateway !== 'CASHFREE') {
      throw new BadRequestException(
        'Only CASHFREE is supported as an active online gateway',
      );
    }
    if (dto.paymentGateway === 'RAZORPAY') {
      throw new BadRequestException(
        'Razorpay is disabled. Only CASHFREE is supported.',
      );
    }

    const {
      razorpayKeySecret,
      cashfreeSecretKey,
      cashfreeWebhookSecret,
      cashfreeSandboxSecretKey,
      cashfreeSandboxWebhookSecret,
      cashfreeProductionSecretKey,
      cashfreeProductionWebhookSecret,
      ...rest
    } = dto as any;
    const data: any = { ...rest };
    const encKey = this.getEncryptionKey();

    if (razorpayKeySecret) {
      data.razorpayKeySecretEnc = encrypt(razorpayKeySecret, encKey);
    }
    if (cashfreeSecretKey) {
      data.cashfreeSecretKeyEnc = encrypt(cashfreeSecretKey, encKey);
    }
    if (cashfreeWebhookSecret) {
      data.cashfreeWebhookSecretEnc = encrypt(cashfreeWebhookSecret, encKey);
    }

    if (cashfreeSandboxSecretKey) {
      data.cashfreeSandboxSecretKeyEnc = encrypt(
        cashfreeSandboxSecretKey,
        encKey,
      );
    }
    if (cashfreeSandboxWebhookSecret) {
      data.cashfreeSandboxWebhookSecretEnc = encrypt(
        cashfreeSandboxWebhookSecret,
        encKey,
      );
    }

    if (cashfreeProductionSecretKey) {
      data.cashfreeProductionSecretKeyEnc = encrypt(
        cashfreeProductionSecretKey,
        encKey,
      );
    }
    if (cashfreeProductionWebhookSecret) {
      data.cashfreeProductionWebhookSecretEnc = encrypt(
        cashfreeProductionWebhookSecret,
        encKey,
      );
    }

    let existing: any = null;
    if (organizationId) {
      existing = await this.prisma.companyProfile.findUnique({
        where: { organizationId },
      });
    } else {
      existing = await this.prisma.companyProfile.findFirst({
        where: { organizationId: null },
      });
      if (!existing) {
        existing = await this.prisma.companyProfile.findFirst();
      }
    }

    const targetEnv =
      data.cashfreeEnvironment ||
      dto.cashfreeEnvironment ||
      existing?.cashfreeEnvironment;
    if (targetEnv === 'production') {
      if (data.cashfreeProductionAppId) {
        data.cashfreeAppId = data.cashfreeProductionAppId;
      } else if (data.cashfreeAppId && !data.cashfreeAppId.startsWith('TEST')) {
        data.cashfreeProductionAppId = data.cashfreeAppId;
      } else if (existing?.cashfreeProductionAppId) {
        data.cashfreeAppId = existing.cashfreeProductionAppId;
      }

      if (data.cashfreeProductionSecretKeyEnc) {
        data.cashfreeSecretKeyEnc = data.cashfreeProductionSecretKeyEnc;
      } else if (data.cashfreeSecretKeyEnc) {
        data.cashfreeProductionSecretKeyEnc = data.cashfreeSecretKeyEnc;
      } else if (existing?.cashfreeProductionSecretKeyEnc) {
        data.cashfreeSecretKeyEnc = existing.cashfreeProductionSecretKeyEnc;
      }

      if (data.cashfreeProductionWebhookSecretEnc) {
        data.cashfreeWebhookSecretEnc = data.cashfreeProductionWebhookSecretEnc;
      } else if (data.cashfreeWebhookSecretEnc) {
        data.cashfreeProductionWebhookSecretEnc = data.cashfreeWebhookSecretEnc;
      } else if (existing?.cashfreeProductionWebhookSecretEnc) {
        data.cashfreeWebhookSecretEnc =
          existing.cashfreeProductionWebhookSecretEnc;
      }
    } else if (targetEnv === 'sandbox') {
      if (data.cashfreeSandboxAppId) {
        data.cashfreeAppId = data.cashfreeSandboxAppId;
      } else if (data.cashfreeAppId) {
        data.cashfreeSandboxAppId = data.cashfreeAppId;
      } else if (existing?.cashfreeSandboxAppId) {
        data.cashfreeAppId = existing.cashfreeSandboxAppId;
      }

      if (data.cashfreeSandboxSecretKeyEnc) {
        data.cashfreeSecretKeyEnc = data.cashfreeSandboxSecretKeyEnc;
      } else if (data.cashfreeSecretKeyEnc) {
        data.cashfreeSandboxSecretKeyEnc = data.cashfreeSecretKeyEnc;
      } else if (existing?.cashfreeSandboxSecretKeyEnc) {
        data.cashfreeSecretKeyEnc = existing.cashfreeSandboxSecretKeyEnc;
      }

      if (data.cashfreeSandboxWebhookSecretEnc) {
        data.cashfreeWebhookSecretEnc = data.cashfreeSandboxWebhookSecretEnc;
      } else if (data.cashfreeWebhookSecretEnc) {
        data.cashfreeSandboxWebhookSecretEnc = data.cashfreeWebhookSecretEnc;
      } else if (existing?.cashfreeSandboxWebhookSecretEnc) {
        data.cashfreeWebhookSecretEnc =
          existing.cashfreeSandboxWebhookSecretEnc;
      }
    }

    if (existing) {
      return this.prisma.companyProfile.update({
        where: { id: existing.id },
        data,
      });
    }

    let defaultCompanyName = 'NeuraVolt Technology';
    if (organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
      });
      defaultCompanyName = org?.name || 'Company Workspace';
    }

    const defaultData = {
      organizationId: organizationId || null,
      companyName: defaultCompanyName,
      address: '',
      city: 'Hyderabad',
      state: 'Telangana',
      zip: '500081',
      phone: '',
      email: organizationId ? '' : 'info@neuravolt.com',
    };
    return this.prisma.companyProfile.create({
      data: Object.assign({}, defaultData, data),
    });
  }
}
