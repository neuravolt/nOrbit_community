import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { substituteParams } from '../../common/challenge-param-substitution';

/**
 * ChallengeEvaluationReport.aiFeedback holds whatever verification-engine.service.ts's
 * ai-review stage wrote to it — for the current pipeline that's the structured object
 * ai-review.validator.ts builds ({ architectureReview, codeUnderstanding, businessReadiness, ... }),
 * not plain text. JSON.stringify-ing that whole object for display (the previous behavior) meant
 * students saw a raw JSON dump — literal `{`, `"key": "value",` lines — instead of the actual
 * markdown code review sitting inside architectureReview. Confirmed live via a real student
 * attempt's rendered feedback. Falls back to the historical plain-string shape (a legacy pipeline
 * wrote aiFeedback as JSON.stringify(reviewResult) directly, so it could still be a bare string)
 * and, only if neither shape matches, to a JSON dump rather than silently dropping the feedback.
 */
function extractAiFeedbackText(aiFeedback: unknown): string | null {
  if (!aiFeedback) return null;
  if (typeof aiFeedback === 'string') return aiFeedback;
  if (typeof aiFeedback === 'object') {
    const obj = aiFeedback as Record<string, unknown>;
    const text = obj.architectureReview || obj.feedback;
    if (typeof text === 'string' && text.trim()) return text;
  }
  return JSON.stringify(aiFeedback, null, 2);
}

@Injectable()
export class RoadmapService {
  constructor(private readonly prisma: PrismaService) {}

  async getCareers() {
    return this.prisma.launchpadCareer.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { roles: true } } },
    });
  }

  async getRolesByCareer(careerId: string) {
    const career = await this.prisma.launchpadCareer.findUnique({
      where: { id: careerId },
    });
    if (!career) throw new NotFoundException('Career category not found');

    const roles = await this.prisma.launchpadCareerRole.findMany({
      where: { careerId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { technologies: { where: { isActive: true } } } },
      },
    });
    // Flatten _count.technologies -> technologyCount so the frontend doesn't need to know about
    // Prisma's _count shape — was previously not returned at all, so the roles list page hardcoded
    // "6 Technologies" on every card regardless of how many (if any) a role actually had.
    return roles.map((role) => {
      const { _count, ...rest } = role;
      return { ...rest, technologyCount: _count.technologies };
    });
  }

  async getTechnologiesByRole(roleId: string, studentId: string) {
    const role = await this.prisma.launchpadCareerRole.findUnique({
      where: { id: roleId },
    });
    if (!role) throw new NotFoundException('Role not found');

    const technologies = await this.prisma.launchpadTechnology.findMany({
      where: { careerRoleId: roleId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const progressRows =
      await this.prisma.launchpadStudentTechnologyProgress.findMany({
        where: {
          studentId,
          technologyId: { in: technologies.map((t) => t.id) },
        },
      });
    const progressMap = new Map(progressRows.map((p) => [p.technologyId, p]));

    return technologies.map((tech) => ({
      ...tech,
      progress: progressMap.get(tech.id) || {
        currentLevel: 0,
        currentNode: 0,
        overallProgressPercent: 0,
        masteryScore: 0,
        status: 'not_started',
      },
    }));
  }

  async getTechnologyTree(technologyId: string, studentId: string) {
    const tech = await this.prisma.launchpadTechnology.findUnique({
      where: { id: technologyId },
      include: {
        levels: {
          where: { isActive: true },
          orderBy: { levelNumber: 'asc' },
          include: {
            // Phase 1B: explicit select, not a bare include — a bare include would return every
            // column on a published node's own row, including the new draftContent field (a
            // published node can have a pending draft on it) plus codingChallenge's internal
            // evaluationCriteria/evaluationConfig, none of which this tree response should ever
            // carry to a student. Limited to exactly what the Tree page and the internal
            // isUnlocked lookup in getNodeDetails() below actually use.
            nodes: {
              where: { status: 'published' },
              orderBy: { nodeNumber: 'asc' },
              select: { id: true, nodeNumber: true, title: true, status: true },
            },
          },
        },
      },
    });

    if (!tech) throw new NotFoundException('Technology tree not found');

    // Fetch student progress for this technology
    const techProgress =
      await this.prisma.launchpadStudentTechnologyProgress.findUnique({
        where: {
          studentId_technologyId: {
            studentId,
            technologyId,
          },
        },
      });

    // Fetch all node progress items for this student
    const nodeProgressItems =
      await this.prisma.launchpadStudentNodeProgress.findMany({
        where: { studentId },
      });

    const progressMap = new Map(nodeProgressItems.map((p) => [p.nodeId, p]));

    // Determine lock/unlock states dynamically
    let previousLevelCompleted = true; // Level 1 is always unlocked

    const levelsWithLockState = tech.levels.map((level) => {
      const isLevelUnlocked = previousLevelCompleted;
      let allNodesInLevelCompleted = true;
      let previousNodeCompleted = true; // Node 1 in level is always unlocked if level is unlocked

      const nodesWithLockState = level.nodes.map((node) => {
        const progress = progressMap.get(node.id);
        const isCompleted = progress?.status === 'completed';

        // A node is unlocked if the level is unlocked AND (it is node_number 1 OR the previous node is completed)
        const isNodeUnlocked =
          isLevelUnlocked && (node.nodeNumber === 1 || previousNodeCompleted);

        if (!isCompleted) {
          allNodesInLevelCompleted = false;
        }

        previousNodeCompleted = isCompleted;

        return {
          ...node,
          isUnlocked: isNodeUnlocked,
          progress: progress || {
            status: isNodeUnlocked ? 'available' : 'locked',
            quizScore: null,
            challengeSubmissionUrl: null,
            aiReviewScore: null,
            aiReviewFeedback: null,
            mentorReviewStatus: null,
          },
        };
      });

      previousLevelCompleted = allNodesInLevelCompleted;

      return {
        ...level,
        isUnlocked: isLevelUnlocked,
        nodes: nodesWithLockState,
      };
    });

    return {
      technology: {
        id: tech.id,
        name: tech.name,
        description: tech.description,
        icon: tech.icon,
      },
      progress: techProgress || null,
      levels: levelsWithLockState,
    };
  }

  async getNodeDetails(nodeId: string, studentId: string) {
    const node = await this.prisma.launchpadRoadmapNode.findUnique({
      where: { id: nodeId },
      include: {
        level: {
          include: {
            technology: true,
          },
        },
        topic: true,
      },
    });

    if (!node || node.status !== 'published') {
      throw new NotFoundException('Roadmap node not found');
    }

    // Verify student has access to this node (level unlocked and previous node completed)
    const tree = await this.getTechnologyTree(
      node.level.technologyId,
      studentId,
    );
    const nodeInTree = tree.levels
      .flatMap((l) => l.nodes)
      .find((n) => n.id === nodeId);

    if (!nodeInTree || !nodeInTree.isUnlocked) {
      throw new NotFoundException(
        'This node is currently locked. Complete prerequisites first.',
      );
    }

    const progress = await this.prisma.launchpadStudentNodeProgress.findUnique({
      where: { studentId_nodeId: { studentId, nodeId } },
    });

    // Attempt history for the "Evaluation History" panel — mirrors GET
    // /api/launchpad/nodes/:nodeId/history (launchpad.controller.ts) but shaped for this page.
    const reports = await this.prisma.challengeEvaluationReport.findMany({
      where: { studentId, nodeId, submitted: true },
      orderBy: { attemptNumber: 'asc' },
    });

    // Next-node lookup for the "Continue to Next Lesson" CTA once this node is actually done
    // (mentor_approved/completed) — reported live: the bottom bar kept saying "Solve the Coding
    // challenge" even after a 100%-passed, mentor-approved submission, with no way forward at all.
    // Same level, next nodeNumber; falling back to the first node of the next level if this was
    // the last node in its level.
    let nextNode = await this.prisma.launchpadRoadmapNode.findFirst({
      where: {
        technologyLevelId: node.technologyLevelId,
        nodeNumber: { gt: node.nodeNumber },
        status: 'published',
      },
      orderBy: { nodeNumber: 'asc' },
      select: { id: true, title: true },
    });
    if (!nextNode) {
      const nextLevel = await this.prisma.launchpadTechnologyLevel.findFirst({
        where: {
          technologyId: node.level.technologyId,
          levelNumber: { gt: node.level.levelNumber },
          isActive: true,
        },
        orderBy: { levelNumber: 'asc' },
      });
      if (nextLevel) {
        nextNode = await this.prisma.launchpadRoadmapNode.findFirst({
          where: { technologyLevelId: nextLevel.id, status: 'published' },
          orderBy: { nodeNumber: 'asc' },
          select: { id: true, title: true },
        });
      }
    }

    // Phase 0.4 fix: this endpoint previously spread the entire raw node row (`...node`) into
    // the student-facing response, exposing evaluationCriteria/evaluationConfig(minScore)/
    // validationRules/aiInterviewQuestions/challengeType/difficultyMultiplier — none of which
    // the Learn page (apps/web/app/student/nodes/[nodeId]/page.tsx) actually reads (confirmed by
    // grep). trustLevel is kept: the Learn page uses it to show a "pending mentor review" banner
    // (trustLevel B/C always route to mentor review) — a legitimate, low-sensitivity UI need,
    // unlike the grading-rubric fields above. codingChallenge is whitelisted to the sub-fields
    // the Challenge tab renders (objective/requirements/hints/resources) — evaluationCriteria,
    // expectedSkills, difficulty, multiplier, xp, and challengeType are stripped from it.
    const rawChallenge =
      (node.codingChallenge as Record<string, unknown>) || {};
    const safeCodingChallenge = {
      objective: rawChallenge.objective ?? null,
      requirements: rawChallenge.requirements ?? [],
      hints: rawChallenge.hints ?? [],
      resources: rawChallenge.resources ?? [],
    };

    // Per-student unique challenges (Phase 1): read-only — this is a GET, so it only ever shows
    // an ALREADY-resolved instance's content; it never creates one (that only happens when the
    // student clicks Start, LaunchpadController.startChallenge). Duplicates the trivial
    // findByTechnologyAndTopic/findExisting queries (ChallengeTemplateService/
    // ChallengeInstanceGeneratorService) directly via Prisma rather than injecting those
    // services, to avoid a circular RoadmapModule <-> AIOrchestrationModule dependency (that
    // module already imports this one for its curriculum-materialization services). "objective"
    // and "requirements" are the template's own text with this instance's resolved parameters
    // substituted in — never a raw {{placeholder}} or the parameterSchema itself.
    const technologySlug = (node.level as any)?.technology?.slug;
    const topicTitle = (node as any).topic?.title;
    if (technologySlug && topicTitle) {
      const template = await this.prisma.challengeTemplate.findFirst({
        where: { technologySlug, topic: topicTitle, status: 'published' },
        orderBy: { versionNumber: 'desc' },
      });
      if (template) {
        const instance = await this.prisma.challengeInstance.findFirst({
          where: { templateId: template.id, studentId },
          orderBy: { createdAt: 'asc' },
        });
        if (instance) {
          const parameters =
            (instance.parameters as Record<string, unknown>) || {};
          const rawRequirements = Array.isArray(template.requirements)
            ? (template.requirements as string[])
            : [];
          safeCodingChallenge.objective = substituteParams(
            template.learningObjective || '',
            parameters,
          );
          safeCodingChallenge.requirements = rawRequirements.map((r) =>
            substituteParams(r, parameters),
          );
        }
      }
    }

    return {
      id: node.id,
      title: node.title,
      description: node.description,
      learningObjectives: node.learningObjectives,
      videos: node.videos,
      officialDocs: node.officialDocs,
      notes: node.notes,
      cheatsheet: node.cheatsheet,
      codeExamples: node.codeExamples,
      quizQuestions: node.quizQuestions,
      codingChallenge: safeCodingChallenge,
      miniProject: node.miniProject,
      estimatedDurationMinutes: node.estimatedDurationMinutes,
      difficulty: node.difficulty,
      trustLevel: node.trustLevel,
      // Top-level status: the Learn page's progress-step logic reads node.status directly
      // (a convention carried over from the legacy RoadmapNode shape it was originally built
      // against), while scores/feedback/URLs live under node.progress.* below. Reaching this
      // point already required nodeInTree.isUnlocked (checked above, throws otherwise), so any
      // node with no progress row yet is always 'available', regardless of its in-level nodeNumber.
      status: progress?.status || 'available',
      progress: progress || {
        status: 'available',
        quizScore: null,
        challengeSubmissionUrl: null,
        aiReviewScore: null,
        aiReviewFeedback: null,
        mentorReviewStatus: null,
        mentorReviewNotes: null,
      },
      attempts: reports.map((r) => ({
        id: r.id,
        passed: r.passed,
        score: r.finalScore,
        createdAt: r.createdAt,
        githubPrUrl: r.repositoryName
          ? `https://github.com/${r.repositoryName}`
          : null,
        feedback: r.mentorFeedback || extractAiFeedbackText(r.aiFeedback),
      })),
      nextNodeId: nextNode?.id ?? null,
      nextNodeTitle: nextNode?.title ?? null,
    };
  }

  /** Launchpad-native quiz evaluation — mirrors StudentQuizService.evaluateQuiz's scoring and
   * status-hierarchy logic, but reads QuizQuestion.correctIndex (LaunchpadRoadmapNode's field
   * name) instead of legacy RoadmapNode's q.correctAnswer, and writes
   * LaunchpadStudentNodeProgress instead of the legacy StudentNodeProgress. */
  async submitQuiz(
    nodeId: string,
    studentId: string,
    answers: { questionIndex: number; selectedOption: number }[],
  ) {
    const node = await this.prisma.launchpadRoadmapNode.findUnique({
      where: { id: nodeId },
    });
    if (!node) throw new NotFoundException('Roadmap node not found');

    const quizQuestions = (node.quizQuestions as any[]) || [];
    if (quizQuestions.length === 0) {
      throw new NotFoundException('No quiz questions configured for this node');
    }

    let correctCount = 0;
    const explanations: string[] = [];

    quizQuestions.forEach((q, index) => {
      const studentAns = answers.find((ans) => ans.questionIndex === index);
      const isCorrect =
        studentAns && studentAns.selectedOption === q.correctIndex;
      if (isCorrect) correctCount++;
      explanations.push(q.explanation || `Question ${index + 1} explanation.`);
    });

    const totalQuestions = quizQuestions.length;
    const score = Math.round((correctCount / totalQuestions) * 100);

    const evaluationConfig = (node.evaluationConfig as any) || {};
    const passThreshold = evaluationConfig.minScore || 70;
    const passed = score >= passThreshold;

    const currentProgress =
      await this.prisma.launchpadStudentNodeProgress.findUnique({
        where: { studentId_nodeId: { studentId, nodeId } },
      });

    // 'peer_review_pending' and 'mentor_approved' are ordering placeholders only — this backend
    // never actually persists either value onto LaunchpadStudentNodeProgress.status. The frontend
    // already synthesizes 'peer_review_pending' locally for trust-level B/C students, and the real
    // state lives in mentorReviewStatus / PeerReviewAssignment.status instead.
    const statusHierarchy = [
      'locked',
      'available',
      'in_progress',
      'quiz_completed',
      'challenge_completed',
      'ai_verified',
      'peer_review_pending',
      'mentor_approved',
      'completed',
    ];
    const currentStatus = currentProgress?.status || 'available';
    const targetStatus = passed ? 'quiz_completed' : currentStatus;
    const shouldUpdateStatus =
      statusHierarchy.indexOf(targetStatus) >
      statusHierarchy.indexOf(currentStatus);
    const updatedStatus = shouldUpdateStatus ? targetStatus : currentStatus;

    await this.prisma.launchpadStudentNodeProgress.upsert({
      where: { studentId_nodeId: { studentId, nodeId } },
      update: {
        quizScore: score,
        status: updatedStatus,
        quizCompletedAt: new Date(),
      },
      create: {
        studentId,
        nodeId,
        quizScore: score,
        status: passed ? 'quiz_completed' : 'in_progress',
        quizCompletedAt: new Date(),
      },
    });

    return { score, correctCount, totalQuestions, explanations, passed };
  }
}
