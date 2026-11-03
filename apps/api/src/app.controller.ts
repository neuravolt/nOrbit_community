import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('install-guardian.sh')
  async getInstallScript(@Res() res: Response) {
    const scriptPath = path.resolve(
      process.cwd(),
      'scripts',
      'install-guardian.sh',
    );
    const altPath = path.resolve(
      process.cwd(),
      '..',
      '..',
      'scripts',
      'install-guardian.sh',
    );
    const finalPath = fs.existsSync(scriptPath) ? scriptPath : altPath;

    if (fs.existsSync(finalPath)) {
      res.setHeader('Content-Type', 'text/x-shellscript');
      return res.sendFile(finalPath);
    }
    return res
      .status(404)
      .send('# Error: install-guardian.sh not found on server.');
  }
}
