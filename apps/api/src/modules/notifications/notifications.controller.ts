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
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import {
  CreateNotificationDto,
  ListNotificationsQuery,
} from './dto/notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserDto } from '../auth';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.createInApp(createNotificationDto);
  }

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query() query: ListNotificationsQuery,
  ) {
    return this.notificationsService.listUserNotifications(user.id, query);
  }

  @Patch('read-all')
  readAll(@CurrentUser() user: CurrentUserDto) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    return this.notificationsService.markAsRead(id, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    return this.notificationsService.remove(id, user.id);
  }
}
