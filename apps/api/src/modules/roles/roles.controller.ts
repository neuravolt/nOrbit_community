import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleDto, RoleListDto } from './dto/role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Roles(['SUPER_ADMIN'])
  async createRole(@Body() createRoleDto: CreateRoleDto): Promise<RoleDto> {
    return this.rolesService.createRole(createRoleDto);
  }

  @Get()
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  async listRoles(): Promise<RoleListDto[]> {
    return this.rolesService.listRoles();
  }

  @Get(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  async getRole(@Param('id') id: string): Promise<RoleDto> {
    return this.rolesService.getRoleById(id);
  }

  @Patch(':id')
  @Roles(['SUPER_ADMIN'])
  async updateRole(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ): Promise<RoleDto> {
    return this.rolesService.updateRole(id, updateRoleDto);
  }

  @Delete(':id')
  @Roles(['SUPER_ADMIN'])
  @HttpCode(200)
  async deleteRole(@Param('id') id: string): Promise<{ message: string }> {
    return this.rolesService.deleteRole(id);
  }
}
