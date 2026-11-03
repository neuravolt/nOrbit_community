import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CareerRoleService } from '../services/career-role.service';
import {
  CreateCareerRoleDto,
  UpdateCareerRoleDto,
} from '../dto/career-role.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../users/guards/roles.guard';
import { RoleField } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(['SUPER_ADMIN', 'MANAGER'])
export class CareerRoleController {
  constructor(private service: CareerRoleService) {}

  @Get('careers/:careerId/roles')
  async getByCareer(@Param('careerId') careerId: string) {
    const data = await this.service.findByCareer(careerId);
    return {
      success: true,
      data,
      message: 'Career roles retrieved successfully',
    };
  }

  @Post('careers/:careerId/roles')
  async create(
    @Param('careerId') careerId: string,
    @Body() dto: CreateCareerRoleDto,
  ) {
    const data = await this.service.create(careerId, dto);
    return { success: true, data, message: 'Career role created successfully' };
  }

  @Put('roles/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateCareerRoleDto) {
    const data = await this.service.update(id, dto);
    return { success: true, data, message: 'Career role updated successfully' };
  }

  @Delete('roles/:id')
  async delete(@Param('id') id: string) {
    const data = await this.service.softDelete(id);
    return { success: true, data, message: 'Career role deleted successfully' };
  }
}
