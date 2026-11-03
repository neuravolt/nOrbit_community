import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUserDto } from '../auth/dto/auth-response.dto';
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
} from './dto/organization.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createOrganization(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.createOrganization(user.id, dto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyOrganizations(@CurrentUser() user: CurrentUserDto) {
    return this.organizationsService.getMyOrganizations(user.id);
  }

  @Get('invitations/:token')
  async getInvitationByToken(@Param('token') token: string) {
    return this.organizationsService.getInvitationByToken(token);
  }

  @Post('invitations/:token/accept')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @CurrentUser() user: CurrentUserDto,
    @Param('token') token: string,
  ) {
    return this.organizationsService.acceptInvitation(user.id, token);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getOrganizationDetails(
    @Param('id') orgId: string,
    @CurrentUser() user: CurrentUserDto,
  ) {
    return this.organizationsService.getOrganizationDetails(orgId, user.id);
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  async listMembers(
    @Param('id') orgId: string,
    @CurrentUser() user: CurrentUserDto,
  ) {
    return this.organizationsService.listMembers(orgId, user.id);
  }

  @Post(':id/invitations')
  @UseGuards(JwtAuthGuard)
  async inviteMember(
    @Param('id') orgId: string,
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: InviteMemberDto,
  ) {
    return this.organizationsService.inviteMember(orgId, user.id, dto);
  }

  @Patch(':id/members/:userId')
  @UseGuards(JwtAuthGuard)
  async updateMemberRole(
    @Param('id') orgId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organizationsService.updateMemberRole(
      orgId,
      targetUserId,
      dto.role,
      user.id,
    );
  }

  @Delete(':id/members/:userId')
  @UseGuards(JwtAuthGuard)
  async removeMember(
    @Param('id') orgId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: CurrentUserDto,
  ) {
    return this.organizationsService.removeMember(orgId, targetUserId, user.id);
  }
}
