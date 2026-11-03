import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { RolesRepository } from './roles.repository';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleDto, RoleListDto } from './dto/role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly rolesRepository: RolesRepository) {}

  async createRole(createRoleDto: CreateRoleDto): Promise<RoleDto> {
    // Check if role name already exists
    const existing = await this.rolesRepository.findByName(createRoleDto.name);
    if (existing) {
      throw new ConflictException('Role name already in use');
    }

    const role = await this.rolesRepository.create(createRoleDto);
    return this.mapToRoleDto(role);
  }

  async listRoles(): Promise<RoleListDto[]> {
    const roles = await this.rolesRepository.findAll();
    return roles.map((role) => this.mapToRoleListDto(role));
  }

  async getRoleById(id: string): Promise<RoleDto> {
    const role = await this.rolesRepository.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return this.mapToRoleDto(role);
  }

  async updateRole(id: string, updateRoleDto: UpdateRoleDto): Promise<RoleDto> {
    const role = await this.rolesRepository.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Prevent updating system roles
    if (role.isSystem) {
      throw new BadRequestException('Cannot modify system roles');
    }

    // Check name uniqueness if changing
    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existing = await this.rolesRepository.findByName(
        updateRoleDto.name,
      );
      if (existing) {
        throw new ConflictException('Role name already in use');
      }
    }

    const updated = await this.rolesRepository.update(id, updateRoleDto);
    return this.mapToRoleDto(updated);
  }

  async deleteRole(id: string): Promise<{ message: string }> {
    const role = await this.rolesRepository.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Prevent deleting system roles
    if (role.isSystem) {
      throw new BadRequestException('Cannot delete system roles');
    }

    // Prevent deleting if assigned to users
    const hasUsers = await this.rolesRepository.hasUsers(id);
    if (hasUsers) {
      throw new BadRequestException(
        'Cannot delete role that is assigned to users',
      );
    }

    await this.rolesRepository.delete(id);
    return { message: 'Role deleted successfully' };
  }

  private mapToRoleDto(role: any): RoleDto {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map((rp: any) => rp.permission),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  private mapToRoleListDto(role: any): RoleListDto {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissionCount: role.permissions.length,
      permissions: role.permissions.map((rp: any) => rp.permission),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
