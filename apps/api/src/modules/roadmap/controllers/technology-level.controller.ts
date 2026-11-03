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
import { TechnologyLevelService } from '../services/technology-level.service';
import {
  CreateTechnologyLevelDto,
  UpdateTechnologyLevelDto,
} from '../dto/technology-level.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../users/guards/roles.guard';
import { RoleField } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(['SUPER_ADMIN', 'MANAGER'])
export class TechnologyLevelController {
  constructor(private service: TechnologyLevelService) {}

  @Get('technologies/:techId/levels')
  async getByTech(@Param('techId') techId: string) {
    const data = await this.service.findByTech(techId);
    return {
      success: true,
      data,
      message: 'Technology levels retrieved successfully',
    };
  }

  @Get('levels/:id')
  async getOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return {
      success: true,
      data,
      message: 'Technology level retrieved successfully',
    };
  }

  @Post('technologies/:techId/levels')
  async create(
    @Param('techId') techId: string,
    @Body() dto: CreateTechnologyLevelDto,
  ) {
    const data = await this.service.create(techId, dto);
    return {
      success: true,
      data,
      message: 'Technology level created successfully',
    };
  }

  @Put('levels/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateTechnologyLevelDto) {
    const data = await this.service.update(id, dto);
    return {
      success: true,
      data,
      message: 'Technology level updated successfully',
    };
  }

  @Delete('levels/:id')
  async delete(@Param('id') id: string) {
    const data = await this.service.softDelete(id);
    return {
      success: true,
      data,
      message: 'Technology level deleted successfully',
    };
  }
}
