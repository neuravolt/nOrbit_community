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
import { TicketsService } from './tickets.service';
import {
  CreateTicketDto,
  UpdateTicketDto,
  UpdateTicketStatusDto,
  ListTicketsQuery,
  AssignTicketDto,
  CreateTicketCommentDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';
import {
  PermissionsGuard,
  Permissions,
} from '../roles/guards/permissions.guard';

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA', 'EMPLOYEE'])
  @Permissions(['tickets:create'])
  async createTicket(
    @Body() createTicketDto: CreateTicketDto,
    @Req() req: any,
  ) {
    return this.ticketsService.createTicket(createTicketDto, req?.user);
  }

  @Get()
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA', 'EMPLOYEE'])
  @Permissions(['tickets:read'])
  async listTickets(@Query() query: ListTicketsQuery, @Req() req: any) {
    return this.ticketsService.listTickets(query, req?.user);
  }

  @Get(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA', 'EMPLOYEE'])
  @Permissions(['tickets:read'])
  async getTicketById(@Param('id') id: string, @Req() req: any) {
    return this.ticketsService.getTicketById(id, req?.user);
  }

  @Patch(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA'])
  @Permissions(['tickets:update'])
  async updateTicket(
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto,
    @Req() req: any,
  ) {
    return this.ticketsService.updateTicket(id, updateTicketDto, req?.user);
  }

  @Patch(':id/status')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA'])
  @Permissions(['tickets:update'])
  async updateTicketStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateTicketStatusDto,
    @Req() req: any,
  ) {
    return this.ticketsService.updateTicketStatus(
      id,
      updateStatusDto,
      req?.user,
    );
  }

  @Patch(':id/assign')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA'])
  @Permissions(['tickets:update'])
  async assignTicket(
    @Param('id') id: string,
    @Body() assignTicketDto: AssignTicketDto,
    @Req() req: any,
  ) {
    return this.ticketsService.assignTicket(
      id,
      assignTicketDto.assignedToId,
      req?.user,
    );
  }

  @Delete(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['tickets:delete'])
  async deleteTicket(@Param('id') id: string, @Req() req: any) {
    return this.ticketsService.deleteTicket(id, req?.user);
  }

  @Patch(':id/restore')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['tickets:restore'])
  async restoreTicket(@Param('id') id: string, @Req() req: any) {
    return this.ticketsService.restoreTicket(id, req?.user);
  }

  // Comments
  @Post(':id/comments')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA', 'EMPLOYEE'])
  @Permissions(['tickets:comment'])
  async addComment(
    @Param('id') id: string,
    @Body() createCommentDto: CreateTicketCommentDto,
    @Req() req: any,
  ) {
    return this.ticketsService.addComment(
      id,
      req?.user?.id,
      createCommentDto,
      req?.user,
    );
  }

  @Get(':id/comments')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA', 'EMPLOYEE'])
  @Permissions(['tickets:read'])
  async getComments(@Param('id') id: string, @Req() req: any) {
    return this.ticketsService.getComments(id, req?.user?.role, req?.user);
  }

  @Delete('comments/:commentId')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER'])
  @Permissions(['tickets:delete'])
  async deleteComment(@Param('commentId') commentId: string, @Req() req: any) {
    return this.ticketsService.deleteComment(commentId, req?.user);
  }
}
