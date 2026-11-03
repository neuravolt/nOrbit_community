import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { AssignSubscriptionDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';

@Controller('admin/organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(['SUPER_ADMIN'])
export class AdminOrganizationsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @Roles(['SUPER_ADMIN'])
  async listOrganizations(
    @Query('search') search?: string,
    @Query('planId') planId?: string,
  ) {
    return this.subscriptionsService.listOrganizationsWithSubscriptions({
      search,
      planId,
    });
  }

  @Get(':id')
  @Roles(['SUPER_ADMIN'])
  async getOrganizationSubscription(@Param('id') id: string) {
    return this.subscriptionsService.getOrganizationSubscription(id);
  }

  @Patch(':id/subscription')
  @Roles(['SUPER_ADMIN'])
  async updateSubscription(
    @Param('id') id: string,
    @Body() dto: AssignSubscriptionDto,
  ) {
    return this.subscriptionsService.updateSubscription(id, dto);
  }
}
