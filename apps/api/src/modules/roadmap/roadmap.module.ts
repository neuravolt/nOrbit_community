import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CareerController } from './controllers/career.controller';
import { CareerService } from './services/career.service';
import { CareerRoleController } from './controllers/career-role.controller';
import { CareerRoleService } from './services/career-role.service';
import { TechnologyController } from './controllers/technology.controller';
import { TechnologyService } from './services/technology.service';
import { TechnologyLevelController } from './controllers/technology-level.controller';
import { TechnologyLevelService } from './services/technology-level.service';
import { RoadmapNodeController } from './controllers/roadmap-node.controller';
import { RoadmapNodeService } from './services/roadmap-node.service';
import { ContentVersionService } from './services/content-version.service';
import { ChapterService } from './services/chapter.service';
import { TopicService } from './services/topic.service';
import { StaleMarkerService } from './services/stale-marker.service';
import { StaleMarkerController } from './controllers/stale-marker.controller';
import { ChapterTopicController } from './controllers/chapter-topic.controller';
import { ChallengeTestSuiteController } from './controllers/challenge-test-suite.controller';
import { ChallengeTestSuiteService } from './services/challenge-test-suite.service';
import { RoadmapFeatureFlagService } from './roadmap-feature-flag.service';
import { RoadmapFeatureGuard } from './guards/roadmap-feature.guard';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';
import { ContentAuditLogService } from '../../common/audit/content-audit-log.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    CareerController,
    CareerRoleController,
    TechnologyController,
    TechnologyLevelController,
    RoadmapNodeController,
    ChallengeTestSuiteController,
    StaleMarkerController,
    ChapterTopicController,
    RoadmapController,
  ],
  providers: [
    CareerService,
    CareerRoleService,
    TechnologyService,
    TechnologyLevelService,
    RoadmapNodeService,
    ContentVersionService,
    ChapterService,
    TopicService,
    StaleMarkerService,
    ChallengeTestSuiteService,
    RoadmapFeatureFlagService,
    RoadmapFeatureGuard,
    RoadmapService,
    ContentAuditLogService,
  ],
  exports: [
    CareerService,
    CareerRoleService,
    TechnologyService,
    TechnologyLevelService,
    RoadmapNodeService,
    ContentVersionService,
    ChapterService,
    TopicService,
    StaleMarkerService,
    ChallengeTestSuiteService,
    RoadmapFeatureFlagService,
    RoadmapFeatureGuard,
    RoadmapService,
    ContentAuditLogService,
  ],
})
export class RoadmapModule {}
