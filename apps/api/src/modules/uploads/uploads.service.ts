import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UploadsService {
  constructor(private readonly prisma: PrismaService) {}

  async saveAttachmentRecord(
    file: Express.Multer.File,
    uploadedById?: string,
    uploadedByClientUserId?: string,
    taskId?: string,
    ticketId?: string,
    projectId?: string,
    isInternal: boolean = false,
    customName?: string,
    category?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const url = `/uploads/${file.filename}`;
    const fileExt = path.extname(file.originalname);

    let finalName = file.originalname;
    if (customName && customName.trim()) {
      const trimmed = customName.trim();
      finalName = trimmed.toLowerCase().endsWith(fileExt.toLowerCase())
        ? trimmed
        : `${trimmed}${fileExt}`;
    }

    if (
      category &&
      category.trim() &&
      category.trim().toUpperCase() !== 'ALL'
    ) {
      finalName = `[${category.toUpperCase().trim()}] ${finalName}`;
    }

    let organizationId: string | null = null;
    if (uploadedById) {
      const u = await this.prisma.user.findUnique({
        where: { id: uploadedById },
        select: { activeOrganizationId: true, organizationId: true },
      });
      organizationId = u?.activeOrganizationId || u?.organizationId || null;
    } else if (projectId) {
      const p = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
      });
      organizationId = p?.organizationId || null;
    }

    return this.prisma.attachment.create({
      data: {
        filename: file.filename,
        originalName: finalName,
        mimeType: file.mimetype,
        size: file.size,
        url,
        taskId: taskId || null,
        ticketId: ticketId || null,
        projectId: projectId || null,
        uploadedById: uploadedById || null,
        uploadedByClientUserId: uploadedByClientUserId || null,
        organizationId,
        isInternal,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async saveLinkRecord(
    url: string,
    title: string,
    uploadedById?: string,
    uploadedByClientUserId?: string,
    taskId?: string,
    ticketId?: string,
    projectId?: string,
    isInternal: boolean = false,
    category?: string,
  ) {
    if (!url || !url.trim()) {
      throw new BadRequestException('URL is required');
    }

    const cleanUrl = url.trim();
    const cleanTitle = (title && title.trim()) || cleanUrl;

    let finalName = cleanTitle;
    if (
      category &&
      category.trim() &&
      category.trim().toUpperCase() !== 'ALL'
    ) {
      finalName = `[${category.toUpperCase().trim()}] ${finalName}`;
    }

    let organizationId: string | null = null;
    if (uploadedById) {
      const u = await this.prisma.user.findUnique({
        where: { id: uploadedById },
        select: { activeOrganizationId: true, organizationId: true },
      });
      organizationId = u?.activeOrganizationId || u?.organizationId || null;
    } else if (projectId) {
      const p = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
      });
      organizationId = p?.organizationId || null;
    }

    return this.prisma.attachment.create({
      data: {
        filename: cleanTitle,
        originalName: finalName,
        mimeType: 'text/x-uri',
        size: 0,
        url: cleanUrl,
        taskId: taskId || null,
        ticketId: ticketId || null,
        projectId: projectId || null,
        uploadedById: uploadedById || null,
        uploadedByClientUserId: uploadedByClientUserId || null,
        organizationId,
        isInternal,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async getGlobalResources(user?: any) {
    const isCustomer = user?.userType === 'CUSTOMER';
    return this.prisma.attachment.findMany({
      where: {
        projectId: null,
        taskId: null,
        ticketId: null,
        ...(isCustomer
          ? { organizationId: user.activeOrganizationId }
          : { organizationId: null }),
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteAttachment(id: string, user?: any) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        project: { select: { organizationId: true } },
        ticket: { select: { organizationId: true } },
      },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    if (user?.userType === 'CUSTOMER') {
      const activeOrgId = user.activeOrganizationId;
      const targetOrgId =
        attachment.organizationId ||
        attachment.project?.organizationId ||
        attachment.ticket?.organizationId;
      if (targetOrgId && targetOrgId !== activeOrgId) {
        throw new ForbiddenException(
          'You are not authorized to delete attachments from another workspace',
        );
      }
    }
    await this.prisma.attachment.delete({ where: { id } });
    return { success: true, message: 'Attachment deleted successfully' };
  }

  async getAttachmentForStream(id: string, user: any) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        project: { select: { clientId: true, organizationId: true } },
        ticket: { select: { clientId: true, organizationId: true } },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // 1. Client Portal User Authorization Check
    if (user?.clientId) {
      if (attachment.isInternal) {
        throw new ForbiddenException(
          'Internal attachments cannot be accessed by client users',
        );
      }
      const targetClientId =
        attachment.project?.clientId || attachment.ticket?.clientId;
      if (
        targetClientId &&
        targetClientId !== user.clientId &&
        attachment.uploadedByClientUserId !== user.id
      ) {
        throw new ForbiddenException(
          'You are not authorized to view this attachment',
        );
      }
    }

    // 2. Customer User Authorization Check (Multi-Tenant boundary)
    if (user?.userType === 'CUSTOMER') {
      const activeOrgId = user.activeOrganizationId;
      const targetOrgId =
        attachment.organizationId ||
        attachment.project?.organizationId ||
        attachment.ticket?.organizationId;
      if (targetOrgId && targetOrgId !== activeOrgId) {
        throw new ForbiddenException(
          'You do not have access to this organization resource',
        );
      }
    }

    // Resolve file path on storage disk
    const uploadsBase =
      process.env.STORAGE_PATH ||
      path.join(__dirname, '..', '..', '..', 'uploads');
    const filePath = path.join(uploadsBase, attachment.filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found on storage disk');
    }

    return {
      attachment,
      filePath,
    };
  }
}
