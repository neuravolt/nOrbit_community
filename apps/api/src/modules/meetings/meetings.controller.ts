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
  Req,
} from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';
import {
  PermissionsGuard,
  Permissions,
} from '../roles/guards/permissions.guard';
import { Throttle } from '@nestjs/throttler';
import {
  CreateMeetingDto,
  UpdateMeetingDto,
  VerifyMeetingPinDto,
  JoinMeetingDto,
  ListMeetingsQueryDto,
} from './dto';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  // ─── AUTHENTICATED ADMIN ENDPOINTS ──────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['meeting:create'])
  create(@Body() createMeetingDto: CreateMeetingDto, @Req() req: any) {
    return this.meetingsService.create(createMeetingDto, req.user?.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(['SUPER_ADMIN', 'MANAGER', 'SALES', 'DEVELOPER'])
  @Permissions(['meeting:read'])
  findAll(@Query() query: ListMeetingsQueryDto) {
    return this.meetingsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(['SUPER_ADMIN', 'MANAGER', 'SALES', 'DEVELOPER'])
  @Permissions(['meeting:read'])
  findOne(@Param('id') id: string) {
    return this.meetingsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['meeting:update'])
  update(@Param('id') id: string, @Body() updateMeetingDto: UpdateMeetingDto) {
    return this.meetingsService.update(id, updateMeetingDto);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['meeting:update'])
  cancel(@Param('id') id: string) {
    return this.meetingsService.cancel(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['meeting:delete'])
  delete(@Param('id') id: string) {
    return this.meetingsService.delete(id);
  }

  // ─── PUBLIC UNAUTHENTICATED ENDPOINTS ─────────────────────────────────────

  @Get('public/:slug')
  getPublicMeeting(@Param('slug') slug: string) {
    return this.meetingsService.findPublicBySlug(slug);
  }

  @Post('public/:slug/verify')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  verifyPin(@Param('slug') slug: string, @Body() dto: VerifyMeetingPinDto) {
    return this.meetingsService.verifyPublicPin(slug, dto.pin);
  }

  @Post('public/:slug/join')
  joinMeeting(@Param('slug') slug: string, @Body() dto: JoinMeetingDto) {
    return this.meetingsService.joinMeeting(slug, dto.token);
  }
}
