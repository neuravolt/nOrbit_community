import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQuery } from './dto/list-users.query';
import { UserDto, ListUsersResponseDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  private readonly BCRYPT_ROUNDS = 10;

  constructor(private readonly usersRepository: UsersRepository) {}

  async createUser(
    createUserDto: CreateUserDto,
    adminId: string,
  ): Promise<UserDto> {
    const { email, firstName, lastName, password, status, role, roleId } =
      createUserDto;

    // Check if email already exists
    const existingUser = await this.usersRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    // Generate password if not provided
    let passwordHash: string;
    if (password) {
      passwordHash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);
    } else {
      // Generate a random password
      const generatedPassword = Math.random().toString(36).slice(-12);
      passwordHash = await bcrypt.hash(generatedPassword, this.BCRYPT_ROUNDS);
    }

    const user = await this.usersRepository.create({
      email,
      firstName,
      lastName,
      passwordHash,
      status,
      role,
      roleId,
    });

    return this.mapToUserDto(user);
  }

  async listUsers(query: ListUsersQuery): Promise<ListUsersResponseDto> {
    const { users, total, page, limit } =
      await this.usersRepository.findAll(query);

    return {
      data: users.map((user) => this.mapToUserDto(user)),
      meta: {
        total,
        page,
        limit,
        hasMore: page * limit < total,
      },
    };
  }

  async getUserById(id: string): Promise<UserDto> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapToUserDto(user);
  }

  async updateUser(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUserId: string,
  ): Promise<UserDto> {
    // Check if user exists
    const existingUser = await this.usersRepository.findById(id);
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Prevent non-SUPER_ADMIN users from granting SUPER_ADMIN role
    if (updateUserDto.role === 'SUPER_ADMIN') {
      const currentUser = await this.usersRepository.findById(currentUserId);
      if (currentUser?.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException(
          'Only a SUPER_ADMIN user can grant the SUPER_ADMIN role',
        );
      }
    }

    // Prevent changing role or deactivating/suspending a SUPER_ADMIN user
    if (existingUser.role === 'SUPER_ADMIN') {
      if (updateUserDto.role && updateUserDto.role !== 'SUPER_ADMIN') {
        throw new BadRequestException(
          'Cannot change the role of a SUPER_ADMIN user',
        );
      }
      if (updateUserDto.status && updateUserDto.status !== 'ACTIVE') {
        throw new BadRequestException(
          'Cannot deactivate or suspend a SUPER_ADMIN user',
        );
      }
    }

    // Prevent changing own status to INACTIVE
    if (id === currentUserId && updateUserDto.status === 'INACTIVE') {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    // Check email uniqueness if being changed
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailExists = await this.usersRepository.findByEmail(
        updateUserDto.email,
      );
      if (emailExists && emailExists.id !== id) {
        throw new ConflictException('Email already in use');
      }
    }

    let passwordHash: string | undefined;
    if (updateUserDto.password) {
      passwordHash = await bcrypt.hash(
        updateUserDto.password,
        this.BCRYPT_ROUNDS,
      );
    }

    const user = await this.usersRepository.update(id, {
      ...updateUserDto,
      passwordHash,
    });
    return this.mapToUserDto(user);
  }

  async deleteUser(
    id: string,
    currentUserId: string,
  ): Promise<{ message: string }> {
    // Cannot delete own account
    if (id === currentUserId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent deleting a SUPER_ADMIN user
    if (user.role === 'SUPER_ADMIN') {
      throw new BadRequestException('Cannot delete a SUPER_ADMIN user');
    }

    await this.usersRepository.softDelete(id);
    return { message: 'User deleted successfully' };
  }

  async restoreUser(id: string): Promise<UserDto> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const restored = await this.usersRepository.restore(id);
    return this.mapToUserDto(restored);
  }

  private mapToUserDto(user: any): UserDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      status: user.isActive ? 'ACTIVE' : 'INACTIVE',
      role: user.role,
      roleId: user.userRoles?.[0]?.roleId || undefined,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
