import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class RoadmapFeatureFlagService {
  constructor(private prisma: PrismaService) {}

  async isEnabled(feature: string): Promise<boolean> {
    try {
      // Look up in Config or RoadmapConfig table
      const config = await (this.prisma as any).systemConfig
        ?.findUnique({
          where: { key: `feature_flag_${feature}` },
        })
        .catch(() => null);

      if (config) {
        return config.value === 'true';
      }
    } catch (e) {
      console.warn(
        'SystemConfig query failed. Defaulting to true for rollout safety.',
      );
    }

    // Default configuration for rollout safety
    const defaults: Record<string, boolean> = {
      roadmap: true,
      ai_generation: true,
      github_auto_create: true,
    };

    return defaults[feature] ?? false;
  }
}
