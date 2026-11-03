import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CareerService } from '../services/career.service';
import { CreateCareerDto, UpdateCareerDto } from '../dto/career.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../users/guards/roles.guard';
import { RoleField } from '@prisma/client';

@Controller('admin/careers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(['SUPER_ADMIN', 'MANAGER'])
export class CareerController {
  constructor(private service: CareerService) {}

  @Get()
  async getAll(@Query('page') page = '1', @Query('limit') limit = '10') {
    const data = await this.service.findAll(Number(page), Number(limit));
    return { success: true, data, message: 'Careers retrieved successfully' };
  }

  @Post()
  async create(@Body() dto: CreateCareerDto) {
    const data = await this.service.create(dto);
    return { success: true, data, message: 'Career created successfully' };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCareerDto) {
    const data = await this.service.update(id, dto);
    return { success: true, data, message: 'Career updated successfully' };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    const data = await this.service.softDelete(id);
    return { success: true, data, message: 'Career deleted successfully' };
  }
}
