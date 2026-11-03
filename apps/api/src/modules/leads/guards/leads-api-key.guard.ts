import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { LeadsService } from '../leads.service';

@Injectable()
export class LeadsApiKeyGuard implements CanActivate {
  constructor(private readonly leadsService: LeadsService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Extract from x-api-key header, Authorization: Bearer, or query param
    let apiKey = request.headers['x-api-key'];
    if (!apiKey && request.headers.authorization) {
      const parts = request.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        apiKey = parts[1];
      }
    }
    if (!apiKey && request.query && request.query.api_key) {
      apiKey = request.query.api_key;
    }

    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException(
        'Missing API key. Please provide your x-api-key header.',
      );
    }

    const isValid = this.leadsService.validateApiKey(apiKey.trim());
    if (!isValid) {
      throw new UnauthorizedException('Invalid API key provided.');
    }

    return true;
  }
}
