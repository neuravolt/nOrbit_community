import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  CreateChallengeTestSuiteDto,
  UpdateChallengeTestSuiteDto,
} from '../dto/challenge-test-suite.dto';

// Phase 2 (Hidden Tests): admin CRUD for LaunchpadRoadmapNode's hidden test suites
// (challenge_test_suites, stage='test'). This table and its columns already existed
// (schema.prisma) with 0 rows written anywhere in the codebase — this service is what actually
// populates it. Deliberately separate from RoadmapNodeService/Phase 1B's draft-publish flow:
// hidden tests are a distinct relational table, not part of LaunchpadRoadmapNode.codingChallenge
// JSON, so they are never part of `draftContent` and every write here is immediate (no draft
// state) — the same way `publish()`/`unpublish()` on RoadmapNodeService already write directly.
//
// Every create/update/delete here bumps the node's `challengeVersion` by exactly 1. Unlike
// RoadmapNodeService.publishDraft's `isChallengeRelevantChange` (which deep-compares because
// draftContent mixes challenge-relevant and unrelated fields together), every row in this table
// IS challenge-relevant by definition — there is no "unrelated" edit to filter out — so bumping
// unconditionally is the correct behavior, not a shortcut. This is what makes hidden tests
// "remain compatible with the frozen challenge blueprint/version" (Phase 2 acceptance criterion):
// VerificationEngineService.startChallenge() already snapshots challengeVersion into every new
// attempt's frozen blueprint, so admin edits made here after a student has Started never affect
// that in-flight attempt, exactly like every other challenge-relevant field already behaves.
@Injectable()
export class ChallengeTestSuiteService {
  constructor(private prisma: PrismaService) {}

  async findByNode(nodeId: string) {
    const node = await this.prisma.launchpadRoadmapNode.findUnique({
      where: { id: nodeId },
    });
    if (!node) {
      throw new NotFoundException('Roadmap node not found');
    }
    return this.prisma.challengeTestSuite.findMany({
      where: { nodeId, stage: 'test' },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(nodeId: string, dto: CreateChallengeTestSuiteDto) {
    return this.prisma.$transaction(async (tx) => {
      const node = await tx.launchpadRoadmapNode.findUnique({
        where: { id: nodeId },
      });
      if (!node) {
        throw new NotFoundException('Roadmap node not found');
      }

      const suite = await tx.challengeTestSuite.create({
        data: {
          nodeId,
          stage: 'test',
          name: dto.name,
          testCode: dto.testCode,
          timeoutSec: dto.timeoutSec ?? 30,
          points: dto.points ?? 10,
          isRequired: dto.isRequired ?? true,
          weight: dto.weight ?? 0,
        },
      });

      await tx.launchpadRoadmapNode.update({
        where: { id: nodeId },
        data: { challengeVersion: { increment: 1 } },
      });

      return suite;
    });
  }

  async update(id: string, dto: UpdateChallengeTestSuiteDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.challengeTestSuite.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException('Hidden test suite not found');
      }

      const suite = await tx.challengeTestSuite.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.testCode !== undefined && { testCode: dto.testCode }),
          ...(dto.timeoutSec !== undefined && { timeoutSec: dto.timeoutSec }),
          ...(dto.points !== undefined && { points: dto.points }),
          ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
          ...(dto.weight !== undefined && { weight: dto.weight }),
        },
      });

      await tx.launchpadRoadmapNode.update({
        where: { id: existing.nodeId },
        data: { challengeVersion: { increment: 1 } },
      });

      return suite;
    });
  }

  async delete(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.challengeTestSuite.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException('Hidden test suite not found');
      }

      await tx.challengeTestSuite.delete({ where: { id } });

      await tx.launchpadRoadmapNode.update({
        where: { id: existing.nodeId },
        data: { challengeVersion: { increment: 1 } },
      });

      return { id };
    });
  }

  // ───────────────────────── Slice 5B-7: AI-generated hidden tests ─────────────────────────
  // Everything above this line is the pre-existing manual-authoring path, completely untouched
  // — every row it creates still defaults to reviewStatus "approved" (the schema default) and
  // still bumps challengeVersion immediately, exactly as before.

  /**
   * Drafts an AI-generated hidden test as "pending-review" — deliberately does NOT bump the
   * node's challengeVersion, unlike the manual create() above. An unapproved draft isn't
   * challenge-relevant yet; bumping the version for content nobody has confirmed is real would
   * needlessly invalidate in-flight attempts for a test that might get rejected outright.
   * verification-engine.service.ts's startChallenge (and the legacy code-review.processor.ts
   * path) both filter to reviewStatus "approved" — this row is structurally inert until reviewed,
   * not just conventionally so.
   */
  async createFromGeneration(
    nodeId: string,
    dto: {
      name: string;
      testCode: string;
      timeoutSec?: number;
      points?: number;
      isRequired?: boolean;
      weight?: number;
    },
    generationJobId: string,
  ) {
    const node = await this.prisma.launchpadRoadmapNode.findUnique({
      where: { id: nodeId },
    });
    if (!node) {
      throw new NotFoundException('Roadmap node not found');
    }
    return this.prisma.challengeTestSuite.create({
      data: {
        nodeId,
        stage: 'test',
        name: dto.name,
        testCode: dto.testCode,
        timeoutSec: dto.timeoutSec ?? 30,
        points: dto.points ?? 10,
        isRequired: dto.isRequired ?? true,
        weight: dto.weight ?? 0,
        generationJobId,
        reviewStatus: 'pending-review',
        challengeVersion: node.challengeVersion,
      },
    });
  }

  async findPendingReview(nodeId: string) {
    return this.prisma.challengeTestSuite.findMany({
      where: { nodeId, stage: 'test', reviewStatus: 'pending-review' },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** The moment an AI-drafted test genuinely becomes challenge-relevant — bumps challengeVersion here, not at draft time. */
  async approveGenerated(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.challengeTestSuite.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException('Hidden test suite not found');
      }
      // Slice 5B-14: "validated" (Broken Solutions validation passed, §3 Stage 6b) is also
      // approvable, alongside the pre-existing "pending-review" (a node with no contract/6b never
      // ran, exactly 5B-7's original behavior — the rollback note's own guarantee: "disabling the
      // pipeline reverts to 5B-7's existing manual-review-only behavior").
      if (
        existing.reviewStatus !== 'pending-review' &&
        existing.reviewStatus !== 'validated'
      ) {
        throw new BadRequestException(
          `Cannot approve a test suite with reviewStatus "${existing.reviewStatus}" — only "pending-review" or "validated" suites can be approved.`,
        );
      }

      const suite = await tx.challengeTestSuite.update({
        where: { id },
        data: { reviewStatus: 'approved' },
      });

      await tx.launchpadRoadmapNode.update({
        where: { id: existing.nodeId },
        data: { challengeVersion: { increment: 1 } },
      });

      return suite;
    });
  }

  /** Rejected rows are kept, not deleted — a durable record of what the AI proposed and that a human said no, matching this session's established "never silently delete" convention. Never challenge-relevant, so no challengeVersion bump. The rejection reason (if any) belongs in an AuditLog entry at the caller, not mangled into this row's own fields. */
  async rejectGenerated(id: string) {
    const existing = await this.prisma.challengeTestSuite.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Hidden test suite not found');
    }
    if (existing.reviewStatus !== 'pending-review') {
      throw new BadRequestException(
        `Cannot reject a test suite with reviewStatus "${existing.reviewStatus}" — only "pending-review" suites can be rejected.`,
      );
    }
    return this.prisma.challengeTestSuite.update({
      where: { id },
      data: { reviewStatus: 'rejected' },
    });
  }
}
