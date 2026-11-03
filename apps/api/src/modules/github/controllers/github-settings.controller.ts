import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../users/guards/roles.guard';
import { GithubService } from '../services/github.service';

export type IntegrationScope = 'PROJECTS' | 'LAUNCHPAD';

export class UpdateGithubSettingsDto {
  scope?: IntegrationScope;
  appId?: string;
  appName?: string;
  privateKey?: string;
  webhookSecret?: string;
}

export class ScopedActionDto {
  scope?: IntegrationScope;
}

@Controller('settings/integrations/github')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(['SUPER_ADMIN'])
export class GithubSettingsController {
  constructor(private readonly githubService: GithubService) {}

  private validateScope(scope?: string): IntegrationScope {
    if (!scope || scope === 'PROJECTS') return 'PROJECTS';
    if (scope === 'LAUNCHPAD') return 'LAUNCHPAD';
    throw new BadRequestException(
      `Invalid integration scope: "${scope}". Must be PROJECTS or LAUNCHPAD.`,
    );
  }

  @Get()
  @Roles(['SUPER_ADMIN'])
  async getSettings(@Query('scope') scopeParam?: string) {
    const scope = this.validateScope(scopeParam);
    return this.githubService.getSettingsView(scope);
  }

  @Post()
  @Roles(['SUPER_ADMIN'])
  async updateSettings(@Body() dto: UpdateGithubSettingsDto, @Req() req: any) {
    const scope = this.validateScope(dto?.scope);
    return this.githubService.updateSettings(
      scope,
      {
        appId: dto?.appId,
        appName: dto?.appName,
        privateKey: dto?.privateKey,
        webhookSecret: dto?.webhookSecret,
      },
      req.user,
    );
  }

  @Post('test')
  @Roles(['SUPER_ADMIN'])
  async testConnection(@Body() dto: ScopedActionDto) {
    const scope = this.validateScope(dto?.scope);
    return this.githubService.testScopedConnection(scope);
  }

  @Post('rollback')
  @Roles(['SUPER_ADMIN'])
  async rollbackSettings(@Body() dto: ScopedActionDto, @Req() req: any) {
    const scope = this.validateScope(dto?.scope);
    return this.githubService.rollbackSettings(scope, req.user);
  }
}
