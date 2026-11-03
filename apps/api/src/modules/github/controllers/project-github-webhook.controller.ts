import { Controller, Post, Headers, Body, Req, HttpCode } from '@nestjs/common';
import { GithubService } from '../services/github.service';

@Controller(['projects/github', 'v1/github'])
export class ProjectGithubWebhookController {
  constructor(private readonly githubService: GithubService) {}

  @Post(['webhook', 'webhook/project'])
  @HttpCode(200)
  async handleWebhook(
    @Headers() headers: Record<string, string>,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.githubService.processWebhook(headers, body, req?.rawBody);
  }
}
