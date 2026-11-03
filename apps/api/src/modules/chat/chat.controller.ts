import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import {
  CreateMessageDto,
  CreateConversationDto,
  CreateTaskFromChatDto,
} from './dto/chat.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  async listConversations(@Req() req: any) {
    const isClient = req.user.role === 'CLIENT';
    return this.chatService.listUserConversations(req.user.id, isClient);
  }

  @Post('conversations/direct')
  async getOrCreateDirect(
    @Req() req: any,
    @Body('targetUserId') targetUserId: string,
  ) {
    return this.chatService.getOrCreateDirectConversation(
      req.user.id,
      targetUserId,
    );
  }

  @Post('conversations/channel')
  async createChannel(@Req() req: any, @Body() dto: CreateConversationDto) {
    return this.chatService.createChannelOrGroup(req.user.id, dto);
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('parentId') parentId?: string,
  ) {
    const isClient = req.user.role === 'CLIENT';
    return this.chatService.getMessages(req.user.id, conversationId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
      parentId,
      isClient,
    });
  }

  @Post('conversations/:id/messages')
  async postMessage(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Body() dto: CreateMessageDto,
  ) {
    const isClient = req.user.role === 'CLIENT';
    return this.chatService.postMessage(
      req.user.id,
      conversationId,
      dto,
      isClient,
    );
  }

  @Post('conversations/:id/read')
  async markRead(@Req() req: any, @Param('id') conversationId: string) {
    return this.chatService.markAsRead(req.user.id, conversationId);
  }

  @Post('messages/:id/reaction')
  async toggleReaction(
    @Req() req: any,
    @Param('id') messageId: string,
    @Body('emoji') emoji: string,
  ) {
    return this.chatService.toggleReaction(req.user.id, messageId, emoji);
  }

  @Post('messages/:id/create-task')
  async createTask(
    @Req() req: any,
    @Param('id') messageId: string,
    @Body() taskData: CreateTaskFromChatDto,
  ) {
    return this.chatService.createTaskFromMessage(
      req.user.id,
      messageId,
      taskData,
    );
  }

  @Get('users')
  async listUsers(@Req() req: any, @Query('search') search?: string) {
    return this.chatService.listEmployeesForChat(req.user.id, search);
  }
}
