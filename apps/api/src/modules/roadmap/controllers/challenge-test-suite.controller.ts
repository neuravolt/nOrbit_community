import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ChallengeTestSuiteService } from '../services/challenge-test-suite.service';
import {
  CreateChallengeTestSuiteDto,
  UpdateChallengeTestSuiteDto,
} from '../dto/challenge-test-suite.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../users/guards/roles.guard';

// Phase 2 (Hidden Tests): same guard/RBAC pattern as RoadmapNodeController — admin-only,
// SUPER_ADMIN/MANAGER. testCode (the actual hidden assertions) is returned in full here
// deliberately — this controller IS the admin authoring surface, unlike every student/peer-review
// facing endpoint in launchpad.controller.ts, which never returns testCode or per-suite results.
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(['SUPER_ADMIN', 'MANAGER'])
export class ChallengeTestSuiteController {
  constructor(private service: ChallengeTestSuiteService) {}

  @Get('nodes/:nodeId/hidden-tests')
  async findByNode(@Param('nodeId') nodeId: string) {
    const data = await this.service.findByNode(nodeId);
    return {
      success: true,
      data,
      message: 'Hidden test suites retrieved successfully',
    };
  }

  @Post('nodes/:nodeId/hidden-tests')
  async create(
    @Param('nodeId') nodeId: string,
    @Body() dto: CreateChallengeTestSuiteDto,
  ) {
    const data = await this.service.create(nodeId, dto);
    return {
      success: true,
      data,
      message: 'Hidden test suite created successfully',
    };
  }

  @Put('hidden-tests/:id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateChallengeTestSuiteDto,
  ) {
    const data = await this.service.update(id, dto);
    return {
      success: true,
      data,
      message: 'Hidden test suite updated successfully',
    };
  }

  @Delete('hidden-tests/:id')
  async delete(@Param('id') id: string) {
    const data = await this.service.delete(id);
    return {
      success: true,
      data,
      message: 'Hidden test suite deleted successfully',
    };
  }

  // ───────────────────────── Slice 5B-7: AI-generated hidden tests ─────────────────────────
  // Same guards/RBAC as every other route on this controller.

  @Get('nodes/:nodeId/hidden-tests/pending-review')
  async findPendingReview(@Param('nodeId') nodeId: string) {
    const data = await this.service.findPendingReview(nodeId);
    return {
      success: true,
      data,
      message: 'Pending-review hidden test suites retrieved successfully',
    };
  }

  @Post('hidden-tests/:id/approve')
  async approveGenerated(@Param('id') id: string) {
    const data = await this.service.approveGenerated(id);
    return {
      success: true,
      data,
      message: 'Hidden test suite approved — it is now active for grading.',
    };
  }

  @Post('hidden-tests/:id/reject')
  async rejectGenerated(@Param('id') id: string) {
    const data = await this.service.rejectGenerated(id);
    return {
      success: true,
      data,
      message:
        'Hidden test suite rejected — it will never be used for grading.',
    };
  }
}
