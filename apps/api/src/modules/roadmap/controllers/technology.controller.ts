import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TechnologyService } from '../services/technology.service';
import {
  CreateTechnologyDto,
  UpdateTechnologyDto,
} from '../dto/technology.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../users/guards/roles.guard';
import { RoleField } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(['SUPER_ADMIN', 'MANAGER'])
export class TechnologyController {
  constructor(private service: TechnologyService) {}

  @Get('roles/:roleId/technologies')
  async getByRole(@Param('roleId') roleId: string) {
    const data = await this.service.findByRole(roleId);
    return {
      success: true,
      data,
      message: 'Technologies retrieved successfully',
    };
  }

  @Get('technologies/:id')
  async getOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return {
      success: true,
      data,
      message: 'Technology retrieved successfully',
    };
  }

  @Post('roles/:roleId/technologies')
  async create(
    @Param('roleId') roleId: string,
    @Body() dto: CreateTechnologyDto,
  ) {
    const data = await this.service.create(roleId, dto);
    return { success: true, data, message: 'Technology created successfully' };
  }

  @Put('technologies/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateTechnologyDto) {
    const data = await this.service.update(id, dto);
    return { success: true, data, message: 'Technology updated successfully' };
  }

  @Delete('technologies/:id')
  async delete(@Param('id') id: string) {
    const data = await this.service.softDelete(id);
    return { success: true, data, message: 'Technology deleted successfully' };
  }

  @Patch('technologies/:id/set-default')
  async setDefault(@Param('id') id: string) {
    const data = await this.service.setDefaultStack(id);
    return { success: true, data, message: 'Default stack set successfully' };
  }
}
