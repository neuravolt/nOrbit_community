import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { SubscriptionsService } from './subscriptions.service';
import { UpgradePlanDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';

@Controller('plans')
export class CustomerPlansController {
  constructor(
    private readonly plansService: PlansService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get('public')
  @UseGuards(JwtAuthGuard)
  async getPublicPlans() {
    return this.plansService.getPublicPlans();
  }

  @Get('current')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])
  async getCurrentSubscription(@Request() req: any) {
    const activeOrgId =
      req.user?.activeOrganizationId || req.headers?.['x-organization-id'];

    if (!activeOrgId) {
      throw new ForbiddenException('Active organization context required');
    }

    return this.subscriptionsService.getOrganizationSubscription(activeOrgId);
  }

  @Post('upgrade')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN'])
  async upgradePlan(@Request() req: any, @Body() dto: UpgradePlanDto) {
    const activeOrgId =
      req.user?.activeOrganizationId || req.headers?.['x-organization-id'];

    if (!activeOrgId) {
      throw new ForbiddenException('Active organization context required');
    }

    return this.subscriptionsService.initiateUpgrade(
      activeOrgId,
      req.user.id,
      dto,
    );
  }
}
