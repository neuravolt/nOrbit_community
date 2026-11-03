import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ChapterService } from '../services/chapter.service';
import { TopicService } from '../services/topic.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../users/guards/roles.guard';

// Slice 5B-2 built ChapterService/TopicService as data-layer-only, deliberately with no
// controller — "the plan's Phase 6 slices, which actually generate chapters via the staged
// pipeline, are what will call these methods next." Phase 6's generation endpoints
// (ai-orchestration.controller.ts) write chapters/topics on approval, but nothing ever read
// them back for an admin UI — this is that read surface, reusing the existing service methods
// unchanged. Same guard/RBAC pattern as every other admin controller in this module.
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(['SUPER_ADMIN', 'MANAGER'])
export class ChapterTopicController {
  constructor(
    private chapterService: ChapterService,
    private topicService: TopicService,
  ) {}

  @Get('levels/:levelId/chapters')
  async getChaptersByLevel(@Param('levelId') levelId: string) {
    const data = await this.chapterService.findByLevel(levelId);
    return { success: true, data, message: 'Chapters retrieved successfully' };
  }

  @Get('chapters/:id')
  async getChapter(@Param('id') id: string) {
    const data = await this.chapterService.findOne(id);
    return { success: true, data, message: 'Chapter retrieved successfully' };
  }

  @Get('chapters/:id/topics')
  async getTopicsByChapter(@Param('id') id: string) {
    const data = await this.topicService.findByChapter(id);
    return { success: true, data, message: 'Topics retrieved successfully' };
  }

  @Get('topics/:id')
  async getTopic(@Param('id') id: string) {
    const data = await this.topicService.findOne(id);
    return { success: true, data, message: 'Topic retrieved successfully' };
  }
}
