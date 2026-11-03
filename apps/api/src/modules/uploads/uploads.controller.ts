import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import * as fs from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

// Allow specified file types (images, pdf, doc, docx, xls, xlsx, zip, text)
const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword', // doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.ms-excel', // xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/csv',
  'application/json',
];

@Controller(['upload', 'uploads'])
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get([':id/stream', 'stream/:id'])
  @UseGuards(AuthGuard(['jwt', 'client-jwt']))
  async streamAttachment(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const { attachment, filePath } =
      await this.uploadsService.getAttachmentForStream(id, user);

    res.setHeader(
      'Content-Type',
      attachment.mimeType || 'application/octet-stream',
    );
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.originalName || attachment.filename)}"`,
    );

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.STORAGE_PATH || './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              `Invalid file type: ${file.mimetype}. Allowed: PDF, Word, Excel, Images, Zip, Text.`,
            ),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize:
          parseInt(process.env.MAX_UPLOAD_SIZE_MB || '25', 10) * 1024 * 1024,
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { id: string },
    @Body('taskId') taskId?: string,
    @Body('ticketId') ticketId?: string,
    @Body('projectId') projectId?: string,
    @Body('isInternal') isInternal?: string | boolean,
    @Body('customName') customName?: string,
    @Body('category') category?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required or failed validation');
    }

    const isInternalBool = isInternal === 'true' || isInternal === true;

    return this.uploadsService.saveAttachmentRecord(
      file,
      user.id,
      undefined,
      taskId,
      ticketId,
      projectId,
      isInternalBool,
      customName,
      category,
    );
  }

  @Post('link')
  @UseGuards(JwtAuthGuard)
  async createLink(
    @CurrentUser() user: { id: string },
    @Body('url') url: string,
    @Body('title') title?: string,
    @Body('taskId') taskId?: string,
    @Body('ticketId') ticketId?: string,
    @Body('projectId') projectId?: string,
    @Body('isInternal') isInternal?: string | boolean,
    @Body('category') category?: string,
  ) {
    const isInternalBool = isInternal === 'true' || isInternal === true;
    return this.uploadsService.saveLinkRecord(
      url,
      title || '',
      user.id,
      undefined,
      taskId,
      ticketId,
      projectId,
      isInternalBool,
      category,
    );
  }

  @Get('resources')
  @UseGuards(JwtAuthGuard)
  async getGlobalResources(@CurrentUser() user: any) {
    return this.uploadsService.getGlobalResources(user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteAttachment(@Param('id') id: string, @CurrentUser() user: any) {
    return this.uploadsService.deleteAttachment(id, user);
  }
}
