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
  Request,
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import {
  CreateAssetDto,
  UpdateAssetDto,
  ListAssetsQuery,
  ResetPasswordDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';
import {
  PermissionsGuard,
  Permissions,
} from '../roles/guards/permissions.guard';

const MANAGEMENT_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'CO_FOUNDER',
  'MANAGER',
  'ACCOUNTANT',
];
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

@Controller('assets')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @Roles(MANAGEMENT_ROLES)
  @Permissions(['assets:create'])
  async createAsset(
    @Body() createAssetDto: CreateAssetDto,
    @Request() req: any,
  ) {
    return this.assetsService.createAsset(createAssetDto, req.user);
  }

  @Get()
  @Roles(ALL_ROLES)
  @Permissions(['assets:read'])
  async listAssets(@Query() query: ListAssetsQuery, @Request() req: any) {
    return this.assetsService.listAssets(query, req.user);
  }

  @Get('renewals/upcoming')
  @Roles(MANAGEMENT_ROLES)
  @Permissions(['assets:read'])
  async getUpcomingRenewals(@Request() req: any) {
    return this.assetsService.getUpcomingRenewals(30, req.user);
  }

  @Get('renewals/expired')
  @Roles(MANAGEMENT_ROLES)
  @Permissions(['assets:read'])
  async getExpiredAssets(@Request() req: any) {
    return this.assetsService.getExpiredAssets(req.user);
  }

  @Get(':id')
  @Roles(ALL_ROLES)
  @Permissions(['assets:read'])
  async getAssetById(@Param('id') id: string, @Request() req: any) {
    return this.assetsService.getAssetById(id, req.user);
  }

  @Patch(':id')
  @Roles(MANAGEMENT_ROLES)
  @Permissions(['assets:update'])
  async updateAsset(
    @Param('id') id: string,
    @Body() updateAssetDto: UpdateAssetDto,
    @Request() req: any,
  ) {
    return this.assetsService.updateAsset(id, updateAssetDto, req.user);
  }

  @Patch(':id/reset-password')
  @Roles(MANAGEMENT_ROLES)
  @Permissions(['assets:update'])
  async resetPassword(
    @Param('id') id: string,
    @Body('newPassword') newPassword?: string,
    @Request() req?: any,
  ) {
    return this.assetsService.updateAsset(
      id,
      {
        credentials: { password: newPassword || 'TEMPORARY_RESET' },
      } as any,
      req?.user,
    );
  }

  @Delete(':id')
  @Roles(MANAGEMENT_ROLES)
  @Permissions(['assets:delete'])
  async deleteAsset(@Param('id') id: string, @Request() req: any) {
    return this.assetsService.deleteAsset(id, req.user);
  }

  @Patch(':id/restore')
  @Roles(MANAGEMENT_ROLES)
  @Permissions(['assets:restore', 'assets:update'])
  async restoreAsset(@Param('id') id: string, @Request() req: any) {
    return this.assetsService.restoreAsset(id, req.user);
  }
}
