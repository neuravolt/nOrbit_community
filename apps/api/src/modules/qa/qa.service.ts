import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Priority } from '@prisma/client';
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

@Injectable()
export class QaService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Bug Tracker ---

  async reportBug(dto: CreateBugReportDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    return this.prisma.bugReport.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        stepsToReproduce: dto.stepsToReproduce,
        expectedResult: dto.expectedResult,
        actualResult: dto.actualResult,
        severity: dto.severity as Priority,
        status: 'new',
        assignedToId: dto.assignedToId,
        testCaseId: dto.testCaseId,
      },
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        testCase: true,
      },
    });
  }

  async listBugs(query: ListBugsQuery) {
    const where: any = {};

    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.severity) {
      where.severity = query.severity;
    }
    if (query.assigneeId) {
      where.assignedToId = query.assigneeId;
    }

    return this.prisma.bugReport.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        testCase: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBug(id: string) {
    const bug = await this.prisma.bugReport.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        testCase: true,
      },
    });

    if (!bug) {
      throw new NotFoundException(`Bug report with ID ${id} not found`);
    }

    return bug;
  }

  async updateBug(id: string, dto: UpdateBugReportDto) {
    const bug = await this.getBug(id);

    return this.prisma.bugReport.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        stepsToReproduce: dto.stepsToReproduce,
        expectedResult: dto.expectedResult,
        actualResult: dto.actualResult,
        severity: dto.severity ? (dto.severity as Priority) : undefined,
        assignedToId: dto.assignedToId,
        testCaseId: dto.testCaseId,
      },
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        testCase: true,
      },
    });
  }

  async updateBugStatus(id: string, dto: UpdateBugStatusDto) {
    const bug = await this.getBug(id);
    const oldStatus = bug.status;
    const newStatus = dto.status;

    // Track reopened bug logic:
    // If transitioning from resolved states (fixed, verified, closed) back to new or in_progress,
    // we consider it reopened.
    const isOldResolved = ['fixed', 'verified', 'closed'].includes(oldStatus);
    const isNewActive = ['new', 'in_progress'].includes(newStatus);
    const isReopened = isOldResolved && isNewActive;

    // We can save history or audit log
    if (isReopened) {
      console.log(`Bug ${id} is re-opened!`);
      // We can also create an audit log if the DB has it
      await this.prisma.auditLog.create({
        data: {
          action: 'BUG_REOPENED',
          resourceType: 'BugReport',
          resourceId: id,
          metadata: { oldStatus, newStatus },
        },
      });
    }

    return this.prisma.bugReport.update({
      where: { id },
      data: { status: newStatus },
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        testCase: true,
      },
    });
  }

  async assignBug(id: string, dto: AssignBugDto) {
    const bug = await this.getBug(id);

    return this.prisma.bugReport.update({
      where: { id },
      data: { assignedToId: dto.assignedToId },
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  // --- Test Cases Module ---

  async createTestCase(dto: CreateTestCaseDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    return this.prisma.testCase.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        steps: dto.steps,
        expectedResult: dto.expectedResult,
        status: 'pending',
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    });
  }

  async listTestCases(projectId: string) {
    return this.prisma.testCase.findMany({
      where: { projectId },
      include: {
        project: { select: { id: true, name: true } },
        bugReports: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTestCase(id: string, dto: UpdateTestCaseDto) {
    const testCase = await this.prisma.testCase.findUnique({
      where: { id },
    });
    if (!testCase) {
      throw new NotFoundException(`TestCase with ID ${id} not found`);
    }

    return this.prisma.testCase.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        steps: dto.steps,
        expectedResult: dto.expectedResult,
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    });
  }

  async runTestCase(id: string, dto: RecordTestCaseRunDto) {
    const testCase = await this.prisma.testCase.findUnique({
      where: { id },
    });
    if (!testCase) {
      throw new NotFoundException(`TestCase with ID ${id} not found`);
    }

    return this.prisma.testCase.update({
      where: { id },
      data: {
        status: dto.status,
        lastRunAt: new Date(),
      },
      include: {
        project: { select: { id: true, name: true } },
        bugReports: true,
      },
    });
  }
}
