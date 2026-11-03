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
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { CreatePlanDto, UpdatePlanDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';

@Controller('admin/plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(['SUPER_ADMIN'])
export class AdminPlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  @Roles(['SUPER_ADMIN'])
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.plansService.createPlan(dto);
  }

  @Get()
  @Roles(['SUPER_ADMIN'])
  async listAllPlans(@Query('includeInactive') includeInactive?: string) {
    const shouldInclude = includeInactive === 'false' ? false : true;
    return this.plansService.listAllPlans(shouldInclude);
  }

  @Get(':id')
  @Roles(['SUPER_ADMIN'])
  async getPlanById(@Param('id') id: string) {
    return this.plansService.getPlanById(id);
  }

  @Patch(':id')
  @Roles(['SUPER_ADMIN'])
  async updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.updatePlan(id, dto);
  }

  @Delete(':id')
  @Roles(['SUPER_ADMIN'])
  async deactivatePlan(@Param('id') id: string) {
    return this.plansService.deactivatePlan(id);
  }
}
