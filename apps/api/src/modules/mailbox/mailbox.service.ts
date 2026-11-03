import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as nodemailer from 'nodemailer';
import { simpleParser, ParsedMail } from 'mailparser';

export interface MailboxMessageSummary {
  id: string; // filename
  folder: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  date: Date;
  isRead: boolean;
  hasAttachments?: boolean;
  snippet?: string;
  messageId?: string;
  sizeBytes?: number;
}

@Injectable()
export class MailboxService {
  private readonly logger = new Logger(MailboxService.name);
  private readonly maildirRoot: string;
  private transporter: nodemailer.Transporter;

  constructor(private readonly prisma: PrismaService) {
    this.maildirRoot =
      process.env.MAILDIR_PATH ||
      '/var/www/fastuser/data/email/neuravolt.in/business/.maildir';

    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.trim();
    const hasAuth = !!(smtpUser && smtpPass);

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || '127.0.0.1',
      port: parseInt(process.env.SMTP_PORT || '25', 10),
      secure: process.env.SMTP_SECURE === 'true',
      ...(hasAuth ? { auth: { user: smtpUser, pass: smtpPass } } : {}),
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  /**
   * Resolve physical directory paths for a given folder name in standard Maildir format
   */
  private getFolderPaths(folder: string): string[] {
    const root = this.maildirRoot;
    switch (folder.toLowerCase()) {
      case 'inbox':
        return [path.join(root, 'new'), path.join(root, 'cur')];
      case 'sent':
        return [
          path.join(root, '.Sent', 'new'),
          path.join(root, '.Sent', 'cur'),
        ];
      case 'trash':
        return [
          path.join(root, '.Trash', 'new'),
          path.join(root, '.Trash', 'cur'),
        ];
      case 'junk':
      case 'spam':
        return [
          path.join(root, '.Junk', 'new'),
          path.join(root, '.Junk', 'cur'),
        ];
      case 'drafts':
        return [
          path.join(root, '.Drafts', 'new'),
          path.join(root, '.Drafts', 'cur'),
        ];
      default:
        return [path.join(root, 'new'), path.join(root, 'cur')];
    }
  }

  /**
   * Helper: Parse fast headers from top of raw email file
   */
  private parseFastHeaders(
    filePath: string,
    filename: string,
    folder: string,
  ): MailboxMessageSummary {
    const isNew = filePath.includes('/new/');
    // Standard Maildir flag: :2,S means Seen
    const isRead =
      !isNew &&
      filename.includes(':2,') &&
      filename.split(':2,')[1]?.includes('S');

    let stat: fs.Stats | null = null;
    try {
      stat = fs.statSync(filePath);
    } catch {
      // fallback
    }

    let rawHead = '';
    try {
      const buffer = Buffer.alloc(4096);
      const fd = fs.openSync(filePath, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
      fs.closeSync(fd);
      rawHead = buffer.toString('utf-8', 0, bytesRead);
    } catch {
      rawHead = '';
    }

    const getHeader = (headerName: string): string => {
      const regex = new RegExp(`^${headerName}:\\s*(.*)$`, 'im');
      const match = rawHead.match(regex);
      return match ? match[1].trim() : '';
    };

    const fromRaw = getHeader('From');
    let from = fromRaw || 'Unknown Sender';
    let fromName: string | undefined = undefined;

    if (fromRaw.includes('<')) {
      const nameMatch = fromRaw.match(/^(.*?)\s*<.*>$/);
      if (nameMatch && nameMatch[1]) {
        fromName = nameMatch[1].replace(/["']/g, '').trim();
      }
      const emailMatch = fromRaw.match(/<(.*?)>/);
      if (emailMatch) {
        from = emailMatch[1].trim();
      }
    }

    const to = getHeader('To') || 'business@neuravolt.in';
    const subject = getHeader('Subject') || '(No Subject)';
    const dateStr = getHeader('Date');
    const messageId = getHeader('Message-ID') || getHeader('Message-Id');
    const contentType = getHeader('Content-Type');
    const hasAttachments = contentType
      .toLowerCase()
      .includes('multipart/mixed');

    let parsedDate = stat ? stat.mtime : new Date();
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        parsedDate = parsed;
      }
    }

    return {
      id: Buffer.from(filePath).toString('base64url'),
      folder,
      from,
      fromName,
      to,
      subject,
      date: parsedDate,
      isRead: !!isRead,
      hasAttachments,
      messageId,
      sizeBytes: stat?.size || 0,
    };
  }

  /**
   * List messages in mailbox with pagination and search
   */
  async getInbox(options: {
    folder?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<{
    messages: MailboxMessageSummary[];
    total: number;
    mailbox: string;
  }> {
    const folder = options.folder || 'inbox';
    const limit = options.limit ? Number(options.limit) : 50;
    const offset = options.offset ? Number(options.offset) : 0;
    const search = (options.search || '').toLowerCase().trim();

    const folderDirs = this.getFolderPaths(folder);
    const allFiles: { filePath: string; filename: string; mtime: number }[] =
      [];

    for (const dir of folderDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            // Ignore hidden files and temp files
            if (file.startsWith('.')) continue;
            const fullPath = path.join(dir, file);
            try {
              const stat = fs.statSync(fullPath);
              if (stat.isFile()) {
                allFiles.push({
                  filePath: fullPath,
                  filename: file,
                  mtime: stat.mtimeMs,
                });
              }
            } catch {
              // skip unreadable file
            }
          }
        } catch (err: any) {
          this.logger.warn(
            `Failed to read maildir folder ${dir}: ${err.message}`,
          );
        }
      }
    }

    // Sort newest first
    allFiles.sort((a, b) => b.mtime - a.mtime);

    // Fast-parse all files for filtering & pagination
    const allParsed: MailboxMessageSummary[] = allFiles.map((f) =>
      this.parseFastHeaders(f.filePath, f.filename, folder),
    );

    let filtered = allParsed;
    if (search) {
      filtered = allParsed.filter(
        (m) =>
          m.subject.toLowerCase().includes(search) ||
          m.from.toLowerCase().includes(search) ||
          (m.fromName && m.fromName.toLowerCase().includes(search)) ||
          m.to.toLowerCase().includes(search),
      );
    }

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    return {
      messages: paged,
      total,
      mailbox: 'business@neuravolt.in',
    };
  }

  /**
   * Get single message details (full MIME parse)
   */
  async getMessage(id: string): Promise<any> {
    let filePath: string;
    try {
      filePath = Buffer.from(id, 'base64url').toString('utf-8');
    } catch {
      throw new NotFoundException('Invalid message identifier');
    }

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Email message file not found on server');
    }

    // Security check: ensure file path belongs to maildir root
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(this.maildirRoot))) {
      throw new NotFoundException('Access denied to specified email path');
    }

    try {
      const fileStream = fs.createReadStream(filePath);
      const parsed: ParsedMail = await simpleParser(fileStream);

      return {
        id,
        messageId: parsed.messageId,
        from: parsed.from?.text || '',
        fromAddress: parsed.from?.value?.[0]?.address || '',
        fromName: parsed.from?.value?.[0]?.name || '',
        to: parsed.to
          ? Array.isArray(parsed.to)
            ? parsed.to.map((t) => t.text).join(', ')
            : parsed.to.text
          : '',
        cc: parsed.cc
          ? Array.isArray(parsed.cc)
            ? parsed.cc.map((c) => c.text).join(', ')
            : parsed.cc.text
          : null,
        subject: parsed.subject || '(No Subject)',
        date: parsed.date || new Date(),
        text: parsed.text || '',
        html:
          parsed.html ||
          (parsed.textAsHtml
            ? parsed.textAsHtml
            : `<pre>${parsed.text || ''}</pre>`),
        inReplyTo: parsed.inReplyTo,
        references: Array.isArray(parsed.references)
          ? parsed.references.join(' ')
          : parsed.references,
        attachments: (parsed.attachments || []).map((att) => ({
          filename: att.filename,
          contentType: att.contentType,
          size: att.size,
        })),
      };
    } catch (err: any) {
      this.logger.error(
        `Error parsing email message ${filePath}: ${err.message}`,
      );
      throw new NotFoundException(
        `Failed to parse email message: ${err.message}`,
      );
    }
  }

  /**
   * Outbox / Sent logs from PostgreSQL `sent_emails` table
   */
  async getSentHistory(options: {
    limit?: number;
    offset?: number;
    search?: string;
    entityType?: string;
  }) {
    const limit = options.limit ? Number(options.limit) : 50;
    const offset = options.offset ? Number(options.offset) : 0;
    const search = options.search?.trim();

    const where: any = {};
    if (options.entityType) {
      where.entityType = options.entityType;
    }
    if (search) {
      where.OR = [
        { recipientEmail: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { templateName: { contains: search, mode: 'insensitive' } },
        { smtpMessageId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [emails, total] = await Promise.all([
      this.prisma.sentEmail.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.sentEmail.count({ where }),
    ]);

    return { emails, total };
  }

  /**
   * Invoice delivery history & proof (for /billing/[id] page)
   */
  async getInvoiceDeliveryHistory(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: { select: { id: true, name: true, email: true } } },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    const whereOr: any[] = [{ entityId: invoiceId }];
    if (invoice.invoiceNumber) {
      whereOr.push({
        subject: { contains: invoice.invoiceNumber, mode: 'insensitive' },
      });
    }

    const deliveries = await this.prisma.sentEmail.findMany({
      where: {
        OR: whereOr,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      clientEmail: invoice.client?.email,
      deliveries,
    };
  }

  /**
   * Direct compose or reply email via SMTP
   */
  async sendEmail(dto: {
    to: string;
    subject: string;
    body: string;
    isHtml?: boolean;
    inReplyTo?: string;
    references?: string;
    entityType?: string;
    entityId?: string;
    clientId?: string;
  }) {
    const fromAddress =
      process.env.SMTP_FROM || 'NeuraVolt Business <business@neuravolt.in>';

    const mailOptions: nodemailer.SendMailOptions = {
      from: fromAddress,
      to: dto.to,
      subject: dto.subject,
      ...(dto.isHtml
        ? { html: dto.body }
        : {
            text: dto.body,
            html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${dto.body}</div>`,
          }),
      inReplyTo: dto.inReplyTo,
      references: dto.references,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Mailbox sent email to ${dto.to}: ${info.messageId}`);

      // Record in PostgreSQL `sent_emails`
      const log = await this.prisma.sentEmail.create({
        data: {
          templateName: dto.inReplyTo ? 'mailbox_reply' : 'mailbox_compose',
          recipientEmail: dto.to,
          subject: dto.subject,
          smtpMessageId: info.messageId,
          entityType: dto.entityType || 'MAILBOX',
          entityId: dto.entityId || null,
          clientId: dto.clientId || null,
        },
      });

      return {
        success: true,
        messageId: info.messageId,
        log,
      };
    } catch (err: any) {
      this.logger.error(
        `Failed to send email via SMTP: ${err.message}`,
        err.stack,
      );
      throw new Error(`Failed to send email: ${err.message}`);
    }
  }
}
