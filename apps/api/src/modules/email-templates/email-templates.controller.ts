import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards';

@Controller('email-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(['SUPER_ADMIN', 'MANAGER'])
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @Get()
  listTemplates() {
    return this.emailTemplatesService.listTemplates();
  }

  @Get(':name')
  getTemplate(@Param('name') name: string) {
    return this.emailTemplatesService.getTemplate(name);
  }

  @Put(':name')
  updateTemplate(
    @Param('name') name: string,
    @Body('content') content: string,
    @Body('subject') subject: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.emailTemplatesService.updateTemplate(
      name,
      content,
      subject,
      userId,
    );
  }

  @Post(':name/preview')
  previewTemplate(
    @Param('name') name: string,
    @Body('variables') variables?: Record<string, any>,
  ) {
    return this.emailTemplatesService.previewTemplate(name, variables);
  }

  @Post(':name/versions/:versionId/restore')
  restoreVersion(
    @Param('name') name: string,
    @Param('versionId') versionId: string,
  ) {
    return this.emailTemplatesService.restoreVersion(name, versionId);
  }

  @Post(':name/test')
  sendTestEmail(
    @Param('name') name: string,
    @Body('to') to: string,
    @Body('variables') variables?: Record<string, any>,
  ) {
    return this.emailTemplatesService.sendTestEmail(name, to, variables);
  }
}
