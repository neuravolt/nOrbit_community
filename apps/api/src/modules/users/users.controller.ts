import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQuery } from './dto/list-users.query';
import { UserDto, ListUsersResponseDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserDto } from '../auth';
import { RolesGuard, Roles } from './guards';

const ALL_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'CO_FOUNDER',
  'MANAGER',
  'ACCOUNTANT',
  'DEVELOPER',
  'QA',
  'EMPLOYEE',
];

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() user: CurrentUserDto,
  ): Promise<UserDto> {
    return this.usersService.createUser(createUserDto, user.id);
  }

  @Get()
  @Roles(ALL_ROLES)
  async listUsers(
    @Query() query: ListUsersQuery,
  ): Promise<ListUsersResponseDto> {
    return this.usersService.listUsers(query);
  }

  @Get(':id')
  @Roles(ALL_ROLES)
  async getUser(@Param('id') id: string): Promise<UserDto> {
    return this.usersService.getUserById(id);
  }

  @Patch(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: CurrentUserDto,
  ): Promise<UserDto> {
    return this.usersService.updateUser(id, updateUserDto, user.id);
  }

  @Delete(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @HttpCode(200)
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserDto,
  ): Promise<{ message: string }> {
    return this.usersService.deleteUser(id, user.id);
  }

  @Patch(':id/restore')
  @Roles(['SUPER_ADMIN'])
  async restoreUser(@Param('id') id: string): Promise<UserDto> {
    return this.usersService.restoreUser(id);
  }
}
