import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { RoadmapNodeService } from '../services/roadmap-node.service';
import { ContentVersionService } from '../services/content-version.service';
import {
  CreateRoadmapNodeDto,
  UpdateRoadmapNodeDto,
} from '../dto/roadmap-node.dto';
import { RestoreVersionDto } from '../dto/restore-version.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../users/guards/roles.guard';
import { RoleField } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(['SUPER_ADMIN', 'MANAGER'])
export class RoadmapNodeController {
  constructor(
    private service: RoadmapNodeService,
    private contentVersionService: ContentVersionService,
  ) {}

  @Get('levels/:levelId/nodes')
  async getByLevel(@Param('levelId') levelId: string) {
    const data = await this.service.findByLevel(levelId);
    return {
      success: true,
      data,
      message: 'Roadmap nodes retrieved successfully',
    };
  }

  @Get('nodes/:id')
  async getOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return {
      success: true,
      data,
      message: 'Roadmap node retrieved successfully',
    };
  }

  @Post('levels/:levelId/nodes')
  async create(
    @Param('levelId') levelId: string,
    @Body() dto: CreateRoadmapNodeDto,
  ) {
    const data = await this.service.create(levelId, dto);
    return {
      success: true,
      data,
      message: 'Roadmap node created successfully',
    };
  }

  @Put('nodes/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateRoadmapNodeDto) {
    const data = await this.service.update(id, dto);
    return {
      success: true,
      data,
      message: 'Roadmap node updated successfully',
    };
  }

  @Delete('nodes/:id')
  async delete(@Param('id') id: string) {
    const data = await this.service.softDelete(id);
    return {
      success: true,
      data,
      message: 'Roadmap node deleted successfully',
    };
  }

  @Patch('nodes/:id/publish')
  async publish(@Param('id') id: string, @Req() req: any) {
    const data = await this.service.publish(id, req.user?.id);
    return {
      success: true,
      data,
      message: 'Roadmap node published successfully',
    };
  }

  @Patch('nodes/:id/unpublish')
  async unpublish(@Param('id') id: string, @Req() req: any) {
    const data = await this.service.unpublish(id, req.user?.id);
    return {
      success: true,
      data,
      message: 'Roadmap node unpublished successfully',
    };
  }

  // ───────────────────────── Phase 1B: draft / publish ─────────────────────────
  // Same guards/RBAC as every other route on this controller — admin-only, SUPER_ADMIN/MANAGER.

  @Put('nodes/:id/draft')
  async saveDraft(
    @Param('id') id: string,
    @Body() dto: UpdateRoadmapNodeDto,
    @Req() req: any,
  ) {
    // Slice 5B-16: reviewerId here is what feeds the CONTENT_EDITED audit row's userId — a
    // manual draft save previously left no actor on record at all.
    const data = await this.service.saveDraft(id, dto, {
      source: 'MANUAL',
      reviewerId: req.user?.id,
    });
    return {
      success: true,
      data,
      message: 'Draft saved — published content is unchanged.',
    };
  }

  @Delete('nodes/:id/draft')
  async discardDraft(@Param('id') id: string) {
    const data = await this.service.discardDraft(id);
    return { success: true, data, message: 'Draft discarded.' };
  }

  @Post('nodes/:id/publish-draft')
  async publishDraft(@Param('id') id: string, @Req() req: any) {
    const data = await this.service.publishDraft(id, req.user?.id);
    return { success: true, data, message: 'Draft published successfully.' };
  }

  // ───────────────────────── Slice 5B-1: content version history ─────────────────────────
  // Same guards/RBAC as every other route on this controller — admin-only, SUPER_ADMIN/MANAGER.

  @Get('nodes/:id/versions')
  async listVersions(@Param('id') id: string) {
    const data = await this.contentVersionService.listVersions(id);
    return {
      success: true,
      data,
      message: 'Version history retrieved successfully.',
    };
  }

  @Get('nodes/:id/versions/:versionId')
  async getVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    const data = await this.contentVersionService.getVersion(id, versionId);
    return { success: true, data, message: 'Version retrieved successfully.' };
  }

  @Post('nodes/:id/versions/:versionId/restore')
  async restoreVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Req() req: any,
    @Body() dto?: RestoreVersionDto,
  ) {
    const data = await this.service.restoreVersion(
      id,
      versionId,
      req.user?.id,
      dto?.expectedVersion,
    );
    return {
      success: true,
      data,
      message:
        'Version restored as a new published version — no history was overwritten.',
    };
  }
}
