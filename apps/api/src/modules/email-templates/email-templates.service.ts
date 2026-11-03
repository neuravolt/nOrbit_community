import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import { Queue } from 'bullmq';
import { AppConfig } from '@neuravolt/shared-config';
import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { emailBrand } from '@neuravolt/shared-utils';

const DEFAULT_TEMPLATES = [
  {
    name: 'quote_sent',
    subject: '[QTN-{{quoteNumber}}] {{title}}',
    description: 'Sent to clients containing quote PDF and portal details.',
  },
  {
    name: 'invoice_sent',
    subject: '[INV-{{invoiceNumber}}] Invoice',
    description: 'Sent to clients when a new invoice is generated.',
  },
  {
    name: 'invoice_overdue',
    subject: '[INV-{{invoiceNumber}}] Overdue Reminder',
    description: 'Daily reminder sent to clients for overdue invoices.',
  },
  {
    name: 'ticket_assigned',
    subject: '[TKT-{{ticketNumber}}] Support Assigned: {{ticketTitle}}',
    description: 'Sent to staff assignees when a support ticket is assigned.',
  },
  {
    name: 'ticket_commented',
    subject: '[TKT-{{ticketNumber}}] Support Update',
    description: 'Sent to staff assignees when client replies to a ticket.',
  },
  {
    name: 'project_deadline',
    subject: '[PRJ-{{projectNumber}}] Deadline Approaching: {{projectName}}',
    description:
      'Sent to staff assignees when project tasks reach their deadline.',
  },
  {
    name: 'amc_renewal',
    subject: '[AMC-{{contractNumber}}] Renewal Reminder',
    description:
      'Sent to clients and sales staff prior to AMC contract expiry.',
  },
  {
    name: 'amc_hours_consumed',
    subject: '[AMC-{{contractNumber}}] Hours Consumed Alert',
    description: 'Sent to clients and sales when AMC used hours exceed 80%.',
  },
  {
    name: 'client_portal_access_created',
    subject: 'Welcome to NeuraVolt Client Portal: Access Created',
    description: 'Sent to client contacts with password and login link.',
  },
];

const MOCK_VARIABLES: Record<string, any> = {
  quote_sent: {
    clientName: 'Acme Corporation',
    quoteNumber: 'QTN-2026-06-001',
    title: 'Custom E-commerce Implementation',
    validUntil: '21 Jul 2026',
    ctaLabel: 'View Quote',
    ctaUrl: 'https://teams.neuravolt.in/client/quotes/mock-id',
  },
  invoice_sent: {
    clientName: 'Acme Corporation',
    invoiceNumber: 'INV-2026-06-042',
    amount: '45,000.00',
    dueDate: '28 Jun 2026',
    ctaLabel: 'View Invoice',
    ctaUrl: 'https://teams.neuravolt.in/pay/mock-id',
  },
  invoice_overdue: {
    clientName: 'Acme Corporation',
    invoiceNumber: 'INV-2026-06-042',
    amount: '45,000.00',
    dueDate: '28 Jun 2026',
    ctaLabel: 'View Invoice',
    ctaUrl: 'https://teams.neuravolt.in/pay/mock-id',
  },
  ticket_assigned: {
    userName: 'Kratika',
    ticketTitle: 'Payment Gateway Integration Fails on Checkout',
    priority: 'CRITICAL',
    ticketNumber: 'TKT-8f3a9d2c',
    ctaLabel: 'View Ticket',
    ctaUrl: 'https://teams.neuravolt.in/client/tickets/mock-id',
  },
  ticket_commented: {
    ticketTitle: 'Payment Gateway Integration Fails on Checkout',
    ticketNumber: 'TKT-8f3a9d2c',
    ctaLabel: 'View Ticket',
    ctaUrl: 'https://teams.neuravolt.in/client/tickets/mock-id',
  },
  project_deadline: {
    projectName: 'NeuraVolt OS Mobile App Backend',
    userName: 'Ajay Tomar',
    deadline: '23 Jun 2026',
    ctaLabel: 'View Project',
    ctaUrl: 'https://teams.neuravolt.in/client/projects/mock-id',
  },
  amc_renewal: {
    contractNumber: 'AMC-ACME-2026',
    contractName: 'Annual Gold Maintenance Contract',
    endDate: '31 Dec 2026',
    clientName: 'Acme Corporation',
    ctaLabel: 'View AMC Contract',
    ctaUrl: 'https://teams.neuravolt.in/client/amc/mock-id',
  },
  amc_hours_consumed: {
    contractNumber: 'AMC-ACME-2026',
    usedHours: '82',
    totalHours: '100',
    clientName: 'Acme Corporation',
    ctaLabel: 'View AMC Contract',
    ctaUrl: 'https://teams.neuravolt.in/client/amc/mock-id',
  },
  client_portal_access_created: {
    clientName: 'Kratika',
    email: 'kratika@neuravolt.in',
    password: 'TempPassword123!',
    loginUrl: 'https://teams.neuravolt.in/client/login',
    ctaLabel: 'Access Client Portal',
    ctaUrl: 'https://teams.neuravolt.in/client/login',
  },
};

@Injectable()
export class EmailTemplatesService implements OnModuleInit {
  private notificationQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyProfileService: CompanyProfileService,
  ) {
    this.notificationQueue = new Queue('notifications-queue', {
      connection: {
        url: AppConfig.redisUrl,
        maxRetriesPerRequest: null,
      },
    });
  }

  async onModuleInit() {
    console.log('Seeding default email templates...');
    await this.seedDefaultTemplates();
  }

  private getTemplateDir(): string {
    const srcDir = path.join(
      process.cwd(),
      'src',
      'modules',
      'notifications',
      'templates',
    );
    if (fs.existsSync(srcDir)) return srcDir;
    return path.join(
      process.cwd(),
      'apps',
      'api',
      'src',
      'modules',
      'notifications',
      'templates',
    );
  }

  async seedDefaultTemplates() {
    const templateDir = this.getTemplateDir();

    for (const t of DEFAULT_TEMPLATES) {
      const dbTemplate = await this.prisma.emailTemplate.findUnique({
        where: { name: t.name },
      });

      if (!dbTemplate) {
        // Load default content from hbs file
        const filePath = path.join(templateDir, `${t.name}.hbs`);
        let content = '';
        if (fs.existsSync(filePath)) {
          content = fs.readFileSync(filePath, 'utf-8');
        } else {
          content = `<p>Default template content for ${t.name}</p>`;
        }

        await this.prisma.emailTemplate.create({
          data: {
            name: t.name,
            subject: t.subject,
            description: t.description,
            versions: {
              create: {
                content,
                version: 1,
                isActive: true,
              },
            },
          },
        });
        console.log(`Seeded email template: ${t.name}`);
      }
    }
  }

  async listTemplates() {
    return this.prisma.emailTemplate.findMany({
      include: {
        versions: {
          select: {
            id: true,
            version: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { version: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getTemplate(name: string) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { name },
      include: {
        versions: {
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Email template ${name} not found`);
    }

    return template;
  }

  async updateTemplate(
    name: string,
    content: string,
    subject: string,
    userId?: string,
  ) {
    const template = await this.getTemplate(name);

    // Deactivate previous active versions
    await this.prisma.emailTemplateVersion.updateMany({
      where: { templateId: template.id, isActive: true },
      data: { isActive: false },
    });

    const latestVersion = template.versions[0]?.version || 0;
    const newVersionNum = latestVersion + 1;

    // Create new version
    const newVersion = await this.prisma.emailTemplateVersion.create({
      data: {
        templateId: template.id,
        content,
        version: newVersionNum,
        isActive: true,
        createdById: userId ?? null,
      },
    });

    // Update subject in parent template
    await this.prisma.emailTemplate.update({
      where: { id: template.id },
      data: { subject },
    });

    return newVersion;
  }

  async restoreVersion(name: string, versionId: string) {
    const template = await this.getTemplate(name);
    const version = template.versions.find((v) => v.id === versionId);
    if (!version) {
      throw new NotFoundException(`Version ${versionId} not found`);
    }

    // Deactivate all versions
    await this.prisma.emailTemplateVersion.updateMany({
      where: { templateId: template.id },
      data: { isActive: false },
    });

    // Activate the selected version
    return this.prisma.emailTemplateVersion.update({
      where: { id: versionId },
      data: { isActive: true },
    });
  }

  async previewTemplate(name: string, customVariables?: Record<string, any>) {
    const template = await this.getTemplate(name);
    const activeVersion = template.versions.find((v) => v.isActive);
    if (!activeVersion) {
      throw new BadRequestException(
        `No active version found for template ${name}`,
      );
    }

    const company = await this.companyProfileService.get();
    const portalUrl =
      process.env.CLIENT_PORTAL_URL || 'https://teams.neuravolt.in/client';
    const templateDir = this.getTemplateDir();

    // Register partials
    const partialsDir = path.join(templateDir, 'partials');
    if (fs.existsSync(partialsDir)) {
      const files = fs.readdirSync(partialsDir);
      for (const file of files) {
        if (file.endsWith('.hbs')) {
          const partialName = path.basename(file, '.hbs');
          const partialContent = fs.readFileSync(
            path.join(partialsDir, file),
            'utf-8',
          );
          Handlebars.registerPartial(partialName, partialContent);
        }
      }
    }

    // Load base layout
    const layoutPath = path.join(templateDir, 'layout.hbs');
    let layoutSource = '{{{body}}}';
    if (fs.existsSync(layoutPath)) {
      layoutSource = fs.readFileSync(layoutPath, 'utf-8');
    }

    const variables = customVariables || MOCK_VARIABLES[name] || {};

    const layoutTemplate = Handlebars.compile(layoutSource);
    const bodyTemplate = Handlebars.compile(activeVersion.content);

    const currentYear = new Date().getFullYear();
    const renderedSubject = Handlebars.compile(template.subject)(variables);
    const context = {
      ...variables,
      company,
      portalUrl,
      currentYear,
      brand: emailBrand(name, variables),
      subject: renderedSubject,
    };

    const bodyHtml = bodyTemplate(context);
    const html = layoutTemplate({
      ...context,
      body: bodyHtml,
    });

    return {
      subject: renderedSubject,
      html,
      variables,
    };
  }

  async sendTestEmail(
    name: string,
    to: string,
    customVariables?: Record<string, any>,
  ) {
    const preview = await this.previewTemplate(name, customVariables);

    await this.notificationQueue.add('email-job', {
      to,
      template: name,
      variables: preview.variables,
      subject: preview.subject,
      entityType: 'TEST',
      entityId: 'TEST-ID',
      clientId: 'TEST-CLIENT-ID',
    });

    return { success: true, message: `Test email enqueued for ${to}` };
  }
}
