import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../users/guards/roles.guard';
import { GithubService } from '../services/github.service';

@Controller('launchpad/admin/github')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(['SUPER_ADMIN', 'MANAGER'])
export class GithubAdminController {
  constructor(private readonly githubService: GithubService) {}

  @Get('status')
  async getStatus() {
    return this.githubService.getAdminStatus();
  }

  @Patch('app-name')
  async updateAppName(@Body('appName') appName: string, @Req() req: any) {
    return this.githubService.updateAppName(appName, req.user.id);
  }

  @Post('test')
  async testConnection() {
    return this.githubService.testAppConnection();
  }

  @Get('webhooks')
  async getWebhooks() {
    return this.githubService.getRecentWebhookDeliveries();
  }
}
