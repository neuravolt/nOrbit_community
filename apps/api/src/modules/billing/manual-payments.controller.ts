import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';
import {
  PermissionsGuard,
  Permissions,
} from '../roles/guards/permissions.guard';
import { ManualPaymentsService } from './manual-payments.service';
import {
  ListManualPaymentsQuery,
  RejectManualPaymentDto,
} from './dto/manual-payment.dto';

@Controller('billing/manual-payments')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ManualPaymentsController {
  constructor(private readonly manualPaymentsService: ManualPaymentsService) {}

  @Get()
  @Roles(['SUPER_ADMIN', 'MANAGER', 'SALES'])
  @Permissions(['invoice:read'])
  list(@Query() query: ListManualPaymentsQuery) {
    return this.manualPaymentsService.listManualPayments(query);
  }

  @Post(':id/approve')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['invoice:update'])
  approve(@Param('id') id: string, @Req() req: any) {
    return this.manualPaymentsService.approveManualPayment(id, req.user.id);
  }

  @Post(':id/reject')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['invoice:update'])
  reject(
    @Param('id') id: string,
    @Body() dto: RejectManualPaymentDto,
    @Req() req: any,
  ) {
    return this.manualPaymentsService.rejectManualPayment(
      id,
      req.user.id,
      dto.rejectionReason,
    );
  }

  @Get(':id/proof')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'SALES'])
  @Permissions(['invoice:read'])
  async getProof(@Param('id') id: string, @Res() res: Response) {
    const { stream, filename, contentType } =
      await this.manualPaymentsService.getProofFile(id, { isAdmin: true });

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
    });

    stream.pipe(res);
  }
}
