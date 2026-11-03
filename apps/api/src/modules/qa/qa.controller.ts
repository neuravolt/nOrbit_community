import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QaService } from './qa.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards';
import {
  CreateBugReportDto,
  UpdateBugReportDto,
  UpdateBugStatusDto,
  AssignBugDto,
  ListBugsQuery,
  CreateTestCaseDto,
  UpdateTestCaseDto,
  RecordTestCaseRunDto,
} from './dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class QaController {
  constructor(private readonly qaService: QaService) {}

  // --- Bug Reports ---

  @Post('bugs')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA'])
  reportBug(@Body() dto: CreateBugReportDto) {
    return this.qaService.reportBug(dto);
  }

  @Get('bugs')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA'])
  listBugs(@Query() query: ListBugsQuery) {
    return this.qaService.listBugs(query);
  }

  @Get('bugs/:id')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA'])
  getBug(@Param('id') id: string) {
    return this.qaService.getBug(id);
  }

  @Patch('bugs/:id')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA'])
  updateBug(@Param('id') id: string, @Body() dto: UpdateBugReportDto) {
    return this.qaService.updateBug(id, dto);
  }

  @Patch('bugs/:id/status')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA'])
  updateBugStatus(@Param('id') id: string, @Body() dto: UpdateBugStatusDto) {
    return this.qaService.updateBugStatus(id, dto);
  }

  @Patch('bugs/:id/assign')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA'])
  assignBug(@Param('id') id: string, @Body() dto: AssignBugDto) {
    return this.qaService.assignBug(id, dto);
  }

  // --- Test Cases ---

  @Post('test-cases')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'QA'])
  createTestCase(@Body() dto: CreateTestCaseDto) {
    return this.qaService.createTestCase(dto);
  }

  @Get('test-cases')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA'])
  listTestCases(@Query('projectId') projectId: string) {
    return this.qaService.listTestCases(projectId);
  }

  @Patch('test-cases/:id')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'QA'])
  updateTestCase(@Param('id') id: string, @Body() dto: UpdateTestCaseDto) {
    return this.qaService.updateTestCase(id, dto);
  }

  @Patch('test-cases/:id/run')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'QA'])
  runTestCase(@Param('id') id: string, @Body() dto: RecordTestCaseRunDto) {
    return this.qaService.runTestCase(id, dto);
  }
}
