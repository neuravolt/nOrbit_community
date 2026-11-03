import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoadmapFeatureFlagService } from '../roadmap-feature-flag.service';

@Injectable()
export class RoadmapFeatureGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureFlagService: RoadmapFeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature =
      this.reflector.get<string>('feature', context.getHandler()) ||
      this.reflector.get<string>('feature', context.getClass()) ||
      'roadmap'; // Default fallback

    const enabled = await this.featureFlagService.isEnabled(feature);
    if (!enabled) {
      throw new ServiceUnavailableException(
        `Feature '${feature}' is temporarily unavailable`,
      );
    }

    return true;
  }
}
