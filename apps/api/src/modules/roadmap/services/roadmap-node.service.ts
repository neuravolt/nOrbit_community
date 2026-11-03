import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  CreateRoadmapNodeDto,
  UpdateRoadmapNodeDto,
} from '../dto/roadmap-node.dto';
import { ContentVersionService } from './content-version.service';
import { StaleMarkerService } from './stale-marker.service';
import { ContentAuditLogService } from '../../../common/audit/content-audit-log.service';

// Phase 1B: fields a draft/publish cycle actually manages. Deliberately excludes nodeNumber
// (structural reordering, not "content" — still editable via the existing direct update()
// path) and status/version/publishedAt/challengeVersion (owned by the publish action itself,
// never part of a draft payload).
// Phase 5A (Review Flow): added evaluationConfig — until now nothing ever set it through this
// path (the comment below originally flagged this as a defensive-only check for a field no
// caller populated); AiOrchestrationService.approveJobOutput() is now the first real caller,
// since evaluationConfig is one of the fields a generated challenge specification can legitimately
// propose (it's frozen into ChallengeBlueprint from this exact node column).
const EDITABLE_CONTENT_FIELDS = [
  'title',
  'slug',
  'description',
  'learningObjectives',
  'videos',
  'officialDocs',
  'notes',
  'cheatsheet',
  'codeExamples',
  'quizQuestions',
  'aiInterviewQuestions',
  'codingChallenge',
  'miniProject',
  'validationRules',
  'xpReward',
  'coinsReward',
  'skillMapping',
  'evaluationConfig',
  'careerDnaImpact',
  'estimatedDurationMinutes',
  'difficulty',
  'prerequisites',
] as const;

// Phase 1B: only these fields, if changed, bump challengeVersion — per the approved spec,
// ordinary notes/quiz/content edits must not unnecessarily invalidate a node's challenge
// version. requirements/evaluationCriteria live inside codingChallenge, so a whole-object
// comparison on codingChallenge already covers changes to them. evaluationConfig is now a real
// editable field (Phase 5A) and was already listed here defensively in advance of that.
const CHALLENGE_RELEVANT_FIELDS = [
  'codingChallenge',
  'evaluationConfig',
] as const;

// Slice 5B-12: the "topic content" fields §3's stale-dependency trigger table means by "Topic
// content v3 -> v4" — the teaching material Stage 4 (re-scoped in Phase 6) owns, as opposed to
// the assessment fields (quiz/challenge/interview) that are themselves what gets marked stale
// when these change.
const CORE_CONTENT_RELEVANT_FIELDS = [
  'notes',
  'cheatsheet',
  'learningObjectives',
  'codeExamples',
  'officialDocs',
  'videos',
] as const;

function pickEditableContent(source: Record<string, any>): Record<string, any> {
  const picked: Record<string, any> = {};
  for (const key of EDITABLE_CONTENT_FIELDS) {
    if (source[key] !== undefined) picked[key] = source[key];
  }
  return picked;
}

function isChallengeRelevantChange(
  liveNode: Record<string, any>,
  draft: Record<string, any>,
): boolean {
  return CHALLENGE_RELEVANT_FIELDS.some(
    (key) =>
      key in draft &&
      JSON.stringify(draft[key]) !== JSON.stringify(liveNode[key]),
  );
}

function isCoreContentChange(
  liveNode: Record<string, any>,
  draft: Record<string, any>,
): boolean {
  return CORE_CONTENT_RELEVANT_FIELDS.some(
    (key) =>
      key in draft &&
      JSON.stringify(draft[key]) !== JSON.stringify(liveNode[key]),
  );
}

function hasRealQuiz(node: Record<string, any>): boolean {
  return Array.isArray(node.quizQuestions) && node.quizQuestions.length > 0;
}

function hasRealChallenge(node: Record<string, any>): boolean {
  const requirements = node.codingChallenge?.requirements;
  return Array.isArray(requirements) && requirements.length > 0;
}

@Injectable()
export class RoadmapNodeService {
  constructor(
    private prisma: PrismaService,
    private contentVersionService: ContentVersionService,
    private staleMarkerService: StaleMarkerService,
    // Slice 5B-16: optional so every existing direct-construction call site (this service's own
    // spec files) keeps compiling without a 4th argument — omitting it just means those tests
    // don't assert on the new AuditLog columns, exactly the same backward-compatibility
    // discipline as expectedVersion (Slice 5B-11) above.
    @Optional() private contentAuditLogService?: ContentAuditLogService,
  ) {}

  /**
   * Slice 5B-12: the "content-approval path" trigger from §3's stale-dependency table, applied
   * at both call sites where a node's live content actually changes (publishDraft, restoreVersion
   * — saveDraft doesn't qualify, nothing downstream is affected until a draft actually publishes).
   * Only marks an artifact stale if it currently has real content to invalidate — an empty
   * quiz/challenge/contract has nothing worth flagging.
   *
   * GAP-1 fix (post-5B-15 audit): the plan's second named trigger ("challenge spec changes ->
   * its verification contract") was left unwired when this was first written, because
   * LaunchpadChallengeVerificationContract didn't exist yet (5B-15 added it). Now that it does,
   * both trigger rows from §3's table are handled here: a core-content change (notes/cheatsheet/
   * examples) marks quiz + challenge + contract stale (the first row — a contract's
   * expectedSolution is grounded in the same taught material as the quiz/challenge), and a
   * challenge-relevant change (codingChallenge/evaluationConfig, i.e. `challengeChanged`) marks
   * the contract stale on its own even when no core content changed (the second row — the
   * contract's expectedSolution/brokenSolutions/customGates were written against the old
   * requirements). Either trigger only fires if an *approved* contract currently exists — a
   * draft/rejected contract, or none at all, has nothing live to invalidate.
   */
  private async applyStaleMarkers(
    tx: any,
    liveNodeBefore: Record<string, any>,
    newContent: Record<string, any>,
    nodeId: string,
    contentVersionId: string,
    challengeChanged: boolean,
  ) {
    const coreContentChanged = isCoreContentChange(liveNodeBefore, newContent);
    if (!coreContentChanged && !challengeChanged) return;

    if (coreContentChanged) {
      if (hasRealQuiz(liveNodeBefore)) {
        await this.staleMarkerService.markStale(
          'quiz',
          nodeId,
          contentVersionId,
          tx,
        );
      }
      if (hasRealChallenge(liveNodeBefore)) {
        await this.staleMarkerService.markStale(
          'challenge',
          nodeId,
          contentVersionId,
          tx,
        );
      }
    }

    const approvedContract =
      await tx.launchpadChallengeVerificationContract.findFirst({
        where: { nodeId, approvalStatus: 'approved' },
      });
    if (approvedContract) {
      await this.staleMarkerService.markStale(
        'verification_contract',
        nodeId,
        contentVersionId,
        tx,
      );
    }
  }

  async findByLevel(technologyLevelId: string) {
    return this.prisma.launchpadRoadmapNode.findMany({
      where: { technologyLevelId, status: { not: 'archived' } },
      orderBy: { nodeNumber: 'asc' },
    });
  }

  async findOne(id: string) {
    const node = await this.prisma.launchpadRoadmapNode.findUnique({
      where: { id },
    });
    if (!node) {
      throw new NotFoundException('Roadmap node not found');
    }
    return node;
  }

  async create(technologyLevelId: string, dto: CreateRoadmapNodeDto) {
    const levelExists = await this.prisma.launchpadTechnologyLevel.findUnique({
      where: { id: technologyLevelId },
    });
    if (!levelExists) {
      throw new NotFoundException('TechnologyLevel not found');
    }

    let nodeNumber = dto.nodeNumber;
    if (!nodeNumber) {
      const lastNode = await this.prisma.launchpadRoadmapNode.findFirst({
        where: { technologyLevelId },
        orderBy: { nodeNumber: 'desc' },
      });
      nodeNumber = lastNode ? lastNode.nodeNumber + 1 : 1;
    }

    // LaunchpadRoadmapNode's content fields (learningObjectives, videos, officialDocs, notes,
    // cheatsheet, codeExamples, quizQuestions, codingChallenge, miniProject,
    // aiInterviewQuestions, validationRules, skillMapping, careerDnaImpact) are NOT NULL with
    // no DB default — legacy RoadmapNode allowed all of these to be omitted. Default to an
    // empty list/object so a new admin-created node can be filled in incrementally, exactly
    // like the seed's own `codingChallenge = node.challenge ? {...} : {}` pattern.
    return this.prisma.launchpadRoadmapNode.create({
      data: {
        technologyLevelId,
        nodeNumber,
        title: dto.title,
        slug: dto.slug,
        description: dto.description,
        learningObjectives: dto.learningObjectives ?? [],
        videos: dto.videos ?? [],
        officialDocs: dto.officialDocs ?? [],
        notes: dto.notes ?? '',
        cheatsheet: dto.cheatsheet ?? '',
        codeExamples: dto.codeExamples ?? [],
        quizQuestions: dto.quizQuestions ?? [],
        codingChallenge: dto.codingChallenge ?? {},
        miniProject: dto.miniProject ?? {},
        aiInterviewQuestions: dto.aiInterviewQuestions ?? [],
        validationRules: dto.validationRules ?? {},
        skillMapping: dto.skillMapping ?? {},
        careerDnaImpact: dto.careerDnaImpact ?? {},
        ...(dto.xpReward !== undefined && { xpReward: dto.xpReward }),
        ...(dto.coinsReward !== undefined && { coinsReward: dto.coinsReward }),
        ...(dto.estimatedDurationMinutes !== undefined && {
          estimatedDurationMinutes: dto.estimatedDurationMinutes,
        }),
        ...(dto.difficulty !== undefined && { difficulty: dto.difficulty }),
        ...(dto.prerequisites !== undefined && {
          prerequisites: dto.prerequisites,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  // Launchpad Final Master Plan, Slice 7: two admins opening the same node's editor and both
  // saving previously meant last-write-wins with no warning — the first save's fields would be
  // silently clobbered by the second. When the caller supplies expectedVersion, the update only
  // applies if it still matches the row's current version at write time (checked and applied in
  // a single atomic updateMany — no separate read-then-write race window), and version is bumped
  // so a third concurrent save correctly conflicts against the second's write too. Omitting
  // expectedVersion preserves the old unconditional-overwrite behavior for any caller that
  // doesn't (yet) send one.
  async update(id: string, dto: UpdateRoadmapNodeDto) {
    const { expectedVersion, ...rest } = dto as UpdateRoadmapNodeDto & {
      expectedVersion?: number;
    };

    if (expectedVersion === undefined) {
      return this.prisma.launchpadRoadmapNode.update({
        where: { id },
        data: rest,
      });
    }

    const result = await this.prisma.launchpadRoadmapNode.updateMany({
      where: { id, version: expectedVersion },
      data: { ...rest, version: { increment: 1 } },
    });

    if (result.count === 0) {
      const current = await this.prisma.launchpadRoadmapNode.findUnique({
        where: { id },
        select: { version: true },
      });
      if (!current) {
        throw new NotFoundException('Roadmap node not found');
      }
      throw new ConflictException(
        `This node was changed by someone else since you loaded it (expected version ${expectedVersion}, current version ${current.version}). Reload and retry.`,
      );
    }

    return this.prisma.launchpadRoadmapNode.findUnique({ where: { id } });
  }

  async softDelete(id: string) {
    return this.prisma.launchpadRoadmapNode.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  // Launchpad Final Master Plan, Slice 6: publish/unpublish previously left
  // no audit trail at all — reusing the existing generic AuditLog model and
  // its direct-write convention (as guardian.service.ts/biometric.service.ts
  // already do for their own domains), not a new mechanism. actorId is
  // optional so any other internal caller of these methods that predates
  // this change keeps compiling; the controller (the only real caller) always
  // supplies it.
  async publish(id: string, actorId?: string) {
    const node = await this.prisma.launchpadRoadmapNode.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    });
    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          userId: actorId,
          action: 'ROADMAP_NODE_PUBLISHED',
          resourceType: 'LaunchpadRoadmapNode',
          resourceId: id,
          severity: 'INFO',
        },
      });
    }
    return node;
  }

  async unpublish(id: string, actorId?: string) {
    const node = await this.prisma.launchpadRoadmapNode.update({
      where: { id },
      data: {
        status: 'draft',
        publishedAt: null,
      },
    });
    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          userId: actorId,
          action: 'ROADMAP_NODE_UNPUBLISHED',
          resourceType: 'LaunchpadRoadmapNode',
          resourceId: id,
          severity: 'INFO',
        },
      });
    }
    return node;
  }

  // ───────────────────────── Phase 1B: draft / publish ─────────────────────────

  /**
   * Save an edit as a pending draft — never touches the live/published content fields.
   * draftContent is always stored as a full snapshot (current live values merged with the
   * incoming changes), not a sparse diff, so publishDraft's copy-to-live step is a single,
   * unconditional field assignment — no partial-merge logic at publish time.
   *
   * Slice 5B-1: also records a "draft"-status LaunchpadContentVersion row, in the same
   * transaction as the draftContent write, so a pending edit — AI-generated or manual — is
   * itself part of the history, not just whatever the DB's single draftContent slot currently
   * holds (which the next saveDraft call would silently overwrite). Same transaction, not
   * best-effort: a version-history write failing rolls back the draft write too, rather than
   * leaving live draftContent changed with no matching version row — a half-written state is
   * worse than the save failing outright and the caller retrying.
   *
   * Slice 5B-11: optional `expectedVersion` — the same atomic-conditional-write pattern as
   * update() (Slice 7), extended here. Most relevant for an AI regeneration's merge at approval
   * time (AiOrchestrationService.approveJobOutput): the AI call can take a while, and a
   * concurrent publish/restore landing in that window must be detected, not silently overwritten
   * by a merge computed against stale context. draftContent itself is a full snapshot already
   * merged with whatever the live node has by the time this runs — so a conflict here means "the
   * live node changed since this regeneration started," exactly the race this closes.
   */
  async saveDraft(
    id: string,
    dto: UpdateRoadmapNodeDto,
    versionMeta?: {
      source: 'AI' | 'MANUAL';
      generationJobId?: string;
      instruction?: string;
      reviewerId?: string;
    },
    expectedVersion?: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const node = await tx.launchpadRoadmapNode.findUnique({ where: { id } });
      if (!node) {
        throw new NotFoundException('Roadmap node not found');
      }

      const existingDraft = (node.draftContent as Record<string, any>) || {};
      const draftContent = {
        ...pickEditableContent(node),
        ...existingDraft,
        ...pickEditableContent(dto as Record<string, any>),
      };

      let updated;
      if (expectedVersion === undefined) {
        updated = await tx.launchpadRoadmapNode.update({
          where: { id },
          data: { draftContent },
          select: {
            id: true,
            draftContent: true,
            version: true,
            challengeVersion: true,
            status: true,
            updatedAt: true,
          },
        });
      } else {
        const result = await tx.launchpadRoadmapNode.updateMany({
          where: { id, version: expectedVersion },
          data: { draftContent },
        });
        if (result.count === 0) {
          throw new ConflictException(
            `This node was changed by someone else since this regeneration started (expected version ${expectedVersion}, current version ${node.version}). Reload and retry.`,
          );
        }
        updated = await tx.launchpadRoadmapNode.findUnique({
          where: { id },
          select: {
            id: true,
            draftContent: true,
            version: true,
            challengeVersion: true,
            status: true,
            updatedAt: true,
          },
        });
      }

      const versionRow = await this.contentVersionService.recordVersion(
        {
          nodeId: id,
          content: draftContent,
          source: versionMeta?.source ?? 'MANUAL',
          status: 'draft',
          generationJobId: versionMeta?.generationJobId,
          instruction: versionMeta?.instruction,
          reviewerId: versionMeta?.reviewerId,
        },
        tx,
      );

      // Slice 5B-16: §6's action table — a manual save is EDITED (source HUMAN), an AI
      // regeneration's merge (AiOrchestrationService.approveJobOutput -> saveDraft) is
      // REGENERATED (source AI). oldVersion/newVersion track the ContentVersion chain, not
      // node.version — saveDraft never bumps node.version (that only happens at publish).
      const isAiSource = versionMeta?.source === 'AI';
      await this.contentAuditLogService?.write(
        {
          action: isAiSource ? 'CONTENT_REGENERATED' : 'CONTENT_EDITED',
          resourceType: 'LaunchpadRoadmapNode',
          resourceId: id,
          userId: versionMeta?.reviewerId ?? null,
          oldVersion: versionRow.previousVersionNumber,
          newVersion: versionRow.versionNumber,
          source: isAiSource ? 'AI' : 'HUMAN',
          reason: versionMeta?.instruction ?? null,
        },
        tx,
      );

      return {
        ...updated,
        contentVersionNumber: versionRow.versionNumber,
        previousContentVersionNumber: versionRow.previousVersionNumber,
      };
    });
  }

  /** Discard a pending draft without publishing it. Live content is never touched by this either way. */
  async discardDraft(id: string) {
    const node = await this.prisma.launchpadRoadmapNode.findUnique({
      where: { id },
    });
    if (!node) {
      throw new NotFoundException('Roadmap node not found');
    }
    return this.prisma.launchpadRoadmapNode.update({
      where: { id },
      data: { draftContent: Prisma.JsonNull },
      select: {
        id: true,
        draftContent: true,
        version: true,
        challengeVersion: true,
        status: true,
      },
    });
  }

  /**
   * Publish a pending draft: copies its fields onto the live row, bumps version (always) and
   * challengeVersion (only if challenge-relevant fields actually changed), clears draftContent,
   * and marks the node published — all inside one transaction, so a failure partway through
   * leaves both the live content and the draft completely unchanged (no partial publish).
   * Blueprint freezing (verification-engine.service.ts) is untouched by this — it already reads
   * node.challengeVersion fresh at Start time, so once this bump lands, freezing picks it up
   * automatically with no changes needed there.
   */
  async publishDraft(id: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const node = await tx.launchpadRoadmapNode.findUnique({ where: { id } });
      if (!node) {
        throw new NotFoundException('Roadmap node not found');
      }
      if (!node.draftContent) {
        throw new BadRequestException(
          'No pending draft to publish for this node.',
        );
      }

      const draft = node.draftContent as Record<string, any>;
      const challengeChanged = isChallengeRelevantChange(node, draft);

      const updated = await tx.launchpadRoadmapNode.update({
        where: { id },
        data: {
          ...pickEditableContent(draft),
          draftContent: Prisma.JsonNull,
          version: node.version + 1,
          challengeVersion: challengeChanged
            ? node.challengeVersion + 1
            : node.challengeVersion,
          status: 'published',
          publishedAt: new Date(),
        },
      });

      // Slice 5B-16: source is HUMAN when a real actor triggered this, POLICY when it's an
      // auto-approval-policy-driven publish with no human actor — mirrors the exact
      // adminUserId-presence check ai-orchestration.service.ts's own approve path already uses.
      await this.contentAuditLogService?.write(
        {
          action: 'ROADMAP_NODE_DRAFT_PUBLISHED',
          resourceType: 'LaunchpadRoadmapNode',
          resourceId: id,
          userId: actorId ?? null,
          oldVersion: node.version,
          newVersion: updated.version,
          source: actorId ? 'HUMAN' : 'POLICY',
          metadata: {
            challengeVersionBefore: node.challengeVersion,
            challengeVersionAfter: updated.challengeVersion,
            challengeRelevantChange: challengeChanged,
          },
        },
        tx,
      );

      // Slice 5B-1: the actual content-history row — this is what makes v1 recoverable after
      // v2/v3 publish, unlike the AuditLog entry above (which records that a publish happened
      // and the version numbers, but never the content itself). Same transaction as the
      // publish itself, so a failure here rolls back the whole publish rather than leaving a
      // live node with no corresponding history row.
      const versionRow = await this.contentVersionService.recordVersion(
        {
          nodeId: id,
          content: pickEditableContent(updated),
          source: 'MANUAL',
          status: 'published',
          reviewerId: actorId,
        },
        tx,
      );

      await this.applyStaleMarkers(
        tx,
        node,
        draft,
        id,
        versionRow.id,
        challengeChanged,
      );

      return updated;
    });
  }

  /**
   * Slice 5B-1, §5's explicit lock: "restoring inserts, it never overwrites history." Restoring
   * an older version does NOT delete or rewrite the versions that came after it — it publishes
   * that old content again as a brand-new version, so the full v1→v2→v3→v4(restored v1) chain
   * stays intact and query-able. Mirrors publishDraft's own transaction shape (live-row update +
   * AuditLog + ContentVersion, all atomic) rather than routing through saveDraft+publishDraft as
   * two separate calls, so a restore is exactly as atomic as a normal publish.
   *
   * Slice 5B-11: optional `expectedVersion`, same atomic-conditional-write pattern as update()
   * and saveDraft above — a restore racing a live edit (the professor loaded the version-history
   * panel, someone else published in the meantime, then the professor clicks restore) must be
   * refused, not silently applied on top of a state the professor never actually saw.
   */
  async restoreVersion(
    nodeId: string,
    versionId: string,
    actorId: string,
    expectedVersion?: number,
  ) {
    const target = await this.contentVersionService.getVersion(
      nodeId,
      versionId,
    );

    return this.prisma.$transaction(async (tx) => {
      const node = await tx.launchpadRoadmapNode.findUnique({
        where: { id: nodeId },
      });
      if (!node) {
        throw new NotFoundException('Roadmap node not found');
      }

      const restoredContent = target.content as Record<string, any>;
      const challengeChanged = isChallengeRelevantChange(node, restoredContent);
      const restoreData = {
        ...pickEditableContent(restoredContent),
        draftContent: Prisma.JsonNull,
        version: node.version + 1,
        challengeVersion: challengeChanged
          ? node.challengeVersion + 1
          : node.challengeVersion,
        status: 'published',
        publishedAt: new Date(),
      };

      // Correction made while implementing this: a findUnique read followed by an unconditional
      // update later in the SAME transaction does NOT atomically guard against a concurrent
      // write under Postgres's default read-committed isolation — the update's WHERE clause,
      // not transaction membership, is what a concurrent transaction's commit has to contend
      // with. The atomic updateMany-with-version-in-the-WHERE-clause pattern (identical to
      // update()/saveDraft above) is what's actually required here, same as everywhere else.
      let updated;
      if (expectedVersion === undefined) {
        updated = await tx.launchpadRoadmapNode.update({
          where: { id: nodeId },
          data: restoreData,
        });
      } else {
        const result = await tx.launchpadRoadmapNode.updateMany({
          where: { id: nodeId, version: expectedVersion },
          data: restoreData,
        });
        if (result.count === 0) {
          throw new ConflictException(
            `This node was changed by someone else since you loaded this version history (expected version ${expectedVersion}, current version ${node.version}). Reload and retry.`,
          );
        }
        updated = await tx.launchpadRoadmapNode.findUnique({
          where: { id: nodeId },
        });
      }

      await this.contentAuditLogService?.write(
        {
          action: 'ROADMAP_NODE_VERSION_RESTORED',
          resourceType: 'LaunchpadRoadmapNode',
          resourceId: nodeId,
          userId: actorId,
          oldVersion: node.version,
          newVersion: updated.version,
          source: 'HUMAN',
          reason: `Restored from version ${target.versionNumber} (${target.id})`,
          metadata: {
            restoredFromVersionId: target.id,
            restoredFromVersionNumber: target.versionNumber,
          },
        },
        tx,
      );

      const versionRow = await this.contentVersionService.recordVersion(
        {
          nodeId,
          content: pickEditableContent(updated),
          source: 'MANUAL',
          status: 'published',
          instruction: `Restored from version ${target.versionNumber} (${target.id})`,
          reviewerId: actorId,
        },
        tx,
      );

      await this.applyStaleMarkers(
        tx,
        node,
        restoredContent,
        nodeId,
        versionRow.id,
        challengeChanged,
      );

      return updated;
    });
  }
}
