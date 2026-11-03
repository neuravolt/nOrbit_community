import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(['SUPER_ADMIN', 'MANAGER'])
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.auditLogsService.findAll(query);
  }

  @Get('entity/:type/:id')
  findByEntity(@Param('type') type: string, @Param('id') id: string) {
    return this.auditLogsService.findByEntity(type, id);
  }
}
