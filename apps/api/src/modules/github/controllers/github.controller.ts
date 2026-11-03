import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  HttpCode,
  Headers,
} from '@nestjs/common';
import type { Response } from 'express';
import { StudentJwtAuthGuard } from '../../launchpad/guards/student-auth.guard';
import { GithubService } from '../services/github.service';

const FRONTEND_GITHUB_PAGE = `${process.env.FRONTEND_URL || 'https://teams.neuravolt.in'}/launchpad/github`;

// Deliberately NOT realigned to the `api/` prefix like LaunchpadSkillsController — the
// `callback` route below is a public OAuth redirect target. If a real GitHub App was ever
// configured with this exact callback URL on GitHub's side (outside this codebase, not
// something a frontend grep can see), changing the prefix would silently break that
// registration. The frontend instead calls this controller with an explicit un-prefixed path.
@Controller('launchpad/github')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @UseGuards(StudentJwtAuthGuard)
  @Get('connect')
  async connect(@Req() req: any) {
    const url = await this.githubService.getConnectUrl(req.user.id);
    return { url };
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('installation_id') installationId: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    // If this was an organization / company installation without student OAuth state:
    if (!state && installationId) {
      return res.redirect('/projects?github_installed=1');
    }

    try {
      await this.githubService.handleCallback(code, installationId, state);
      return res.redirect(`${FRONTEND_GITHUB_PAGE}?connected=1`);
    } catch (err: any) {
      return res.redirect(
        `${FRONTEND_GITHUB_PAGE}?error=${encodeURIComponent(err.message || 'GitHub connection failed.')}`,
      );
    }
  }

  @UseGuards(StudentJwtAuthGuard)
  @Post('disconnect')
  @HttpCode(200)
  async disconnect(@Req() req: any) {
    return this.githubService.disconnect(req.user.id);
  }

  @UseGuards(StudentJwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.githubService.getProfile(req.user.id);
  }

  @UseGuards(StudentJwtAuthGuard)
  @Get('repositories')
  async getRepositories(@Req() req: any) {
    return this.githubService.getRepositories(req.user.id);
  }

  @UseGuards(StudentJwtAuthGuard)
  @Get('statistics')
  async getStatistics(@Req() req: any) {
    return this.githubService.getStatistics(req.user.id);
  }

  @UseGuards(StudentJwtAuthGuard)
  @Post('repositories/sync')
  @HttpCode(200)
  async syncRepositories(@Req() req: any) {
    return this.githubService.triggerFullSync(req.user.id);
  }

  @UseGuards(StudentJwtAuthGuard)
  @Post('repositories/:id/track')
  @HttpCode(200)
  async trackRepository(@Param('id') id: string) {
    return this.githubService.toggleTrackRepository(id, true);
  }

  @UseGuards(StudentJwtAuthGuard)
  @Post('repositories/:id/untrack')
  @HttpCode(200)
  async untrackRepository(@Param('id') id: string) {
    return this.githubService.toggleTrackRepository(id, false);
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Headers() headers: Record<string, string>,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.githubService.processWebhook(headers, body, req?.rawBody);
  }
}
