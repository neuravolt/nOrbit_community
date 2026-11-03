import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';
import {
  PaymentConfigService,
  type CreateGatewayAccountDto,
  type UpdateGatewayAccountDto,
} from './payment-config.service';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CO_FOUNDER'];

@Controller('admin/payments/gateway-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminGatewayAccountsController {
  constructor(private readonly paymentConfigService: PaymentConfigService) {}

  @Get()
  @Roles(ADMIN_ROLES)
  listAccounts(@Query() query: { provider?: string; environment?: string }) {
    return this.paymentConfigService.listGatewayAccounts(query);
  }

  @Post()
  @Roles(ADMIN_ROLES)
  @HttpCode(HttpStatus.CREATED)
  createAccount(@Body() dto: CreateGatewayAccountDto) {
    return this.paymentConfigService.createGatewayAccount(dto);
  }

  @Patch(':id')
  @Roles(ADMIN_ROLES)
  updateAccount(@Param('id') id: string, @Body() dto: UpdateGatewayAccountDto) {
    return this.paymentConfigService.updateGatewayAccount(id, dto);
  }

  @Delete(':id')
  @Roles(ADMIN_ROLES)
  deleteAccount(@Param('id') id: string) {
    return this.paymentConfigService.deleteGatewayAccount(id);
  }
}
