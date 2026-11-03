import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';

const FINANCE_ROLES = ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'];

@Controller('accounting')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  // Summary
  @Get('summary')
  @Roles(FINANCE_ROLES)
  getSummary() {
    return this.accountingService.getSummary();
  }

  // ─── Purchase Register ──────────────────────────────────────────────────────

  @Get('purchases')
  @Roles(FINANCE_ROLES)
  listPurchases(@Query() query: any) {
    return this.accountingService.listPurchases(query);
  }

  @Post('purchases')
  @HttpCode(201)
  @Roles(['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'])
  createPurchase(@Body() dto: any, @Req() req: any) {
    return this.accountingService.createPurchase(dto, req.user.id);
  }

  @Patch('purchases/:id')
  @Roles(FINANCE_ROLES)
  updatePurchase(@Param('id') id: string, @Body() dto: any) {
    return this.accountingService.updatePurchase(id, dto);
  }

  @Delete('purchases/:id')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  deletePurchase(@Param('id') id: string) {
    return this.accountingService.deletePurchase(id);
  }

  // ─── Expense Register ───────────────────────────────────────────────────────

  @Get('expenses')
  @Roles(FINANCE_ROLES)
  listExpenses(@Query() query: any) {
    return this.accountingService.listExpenses(query);
  }

  @Post('expenses')
  @HttpCode(201)
  @Roles(FINANCE_ROLES)
  createExpense(@Body() dto: any, @Req() req: any) {
    return this.accountingService.createExpense(dto, req.user.id);
  }

  @Patch('expenses/:id')
  @Roles(FINANCE_ROLES)
  updateExpense(@Param('id') id: string, @Body() dto: any) {
    return this.accountingService.updateExpense(id, dto);
  }

  @Delete('expenses/:id')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  deleteExpense(@Param('id') id: string) {
    return this.accountingService.deleteExpense(id);
  }

  // ─── Bank Book ──────────────────────────────────────────────────────────────

  @Get('bank')
  @Roles(FINANCE_ROLES)
  listBankTransactions(@Query() query: any) {
    return this.accountingService.listBankTransactions(query);
  }

  @Post('bank')
  @HttpCode(201)
  @Roles(FINANCE_ROLES)
  createBankTransaction(@Body() dto: any, @Req() req: any) {
    return this.accountingService.createBankTransaction(dto, req.user.id);
  }

  @Patch('bank/:id')
  @Roles(FINANCE_ROLES)
  updateBankTransaction(@Param('id') id: string, @Body() dto: any) {
    return this.accountingService.updateBankTransaction(id, dto);
  }

  @Delete('bank/:id')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  deleteBankTransaction(@Param('id') id: string) {
    return this.accountingService.deleteBankTransaction(id);
  }

  // ─── Cash Book ──────────────────────────────────────────────────────────────

  @Get('cash')
  @Roles(FINANCE_ROLES)
  listCashTransactions(@Query() query: any) {
    return this.accountingService.listCashTransactions(query);
  }

  @Post('cash')
  @HttpCode(201)
  @Roles(FINANCE_ROLES)
  createCashTransaction(@Body() dto: any, @Req() req: any) {
    return this.accountingService.createCashTransaction(dto, req.user.id);
  }

  @Patch('cash/:id')
  @Roles(FINANCE_ROLES)
  updateCashTransaction(@Param('id') id: string, @Body() dto: any) {
    return this.accountingService.updateCashTransaction(id, dto);
  }

  @Delete('cash/:id')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  deleteCashTransaction(@Param('id') id: string) {
    return this.accountingService.deleteCashTransaction(id);
  }

  // ─── Salary Register ────────────────────────────────────────────────────────

  @Get('salaries')
  @Roles(FINANCE_ROLES)
  listSalaries(@Query() query: any) {
    return this.accountingService.listSalaries(query);
  }

  @Post('salaries')
  @HttpCode(201)
  @Roles(FINANCE_ROLES)
  createSalary(@Body() dto: any, @Req() req: any) {
    return this.accountingService.createSalary(dto, req.user.id);
  }

  @Patch('salaries/:id')
  @Roles(FINANCE_ROLES)
  updateSalary(@Param('id') id: string, @Body() dto: any) {
    return this.accountingService.updateSalary(id, dto);
  }

  @Delete('salaries/:id')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  deleteSalary(@Param('id') id: string) {
    return this.accountingService.deleteSalary(id);
  }
}
