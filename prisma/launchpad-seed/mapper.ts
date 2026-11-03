import { PrismaClient } from '@prisma/client';
import { RoleContent } from './types';

/** Idempotent upsert-on-natural-key seed of one role's content into the Launchpad table family. */
export async function seedRole(prisma: PrismaClient, content: RoleContent): Promise<void> {
  const career = await prisma.launchpadCareer.upsert({
    where: { slug: content.careerSlug },
    create: { name: content.careerName, slug: content.careerSlug, isActive: true },
    update: { name: content.careerName },
  });

  const role = await prisma.launchpadCareerRole.upsert({
    where: { slug: content.roleSlug },
    create: {
      careerId: career.id,
      name: content.roleName,
      slug: content.roleSlug,
      description: content.roleDescription,
      isActive: true,
    },
    update: { name: content.roleName, description: content.roleDescription, careerId: career.id },
  });

  const technology = await prisma.launchpadTechnology.upsert({
    where: { slug: content.technologySlug },
    create: {
      careerRoleId: role.id,
      name: content.technologyName,
      slug: content.technologySlug,
      description: content.technologyDescription,
      defaultStack: true,
      isActive: true,
    },
    update: { name: content.technologyName, description: content.technologyDescription, careerRoleId: role.id },
  });

  for (const level of content.levels) {
    // One transaction per level — a failure partway through a level's nodes never leaves that
    // level half-written, per Part 3's freeze-gate discipline.
    await prisma.$transaction(async (tx) => {
      const levelRow = await tx.launchpadTechnologyLevel.upsert({
        where: { technologyId_levelNumber: { technologyId: technology.id, levelNumber: level.levelNumber } },
        create: {
          technologyId: technology.id,
          levelNumber: level.levelNumber,
          name: level.name,
          description: level.description,
          difficulty: level.difficulty,
          estimatedDurationHours: level.estimatedDurationHours,
          xpRequired: level.xpRequired,
          isActive: true,
        },
        update: {
          name: level.name,
          description: level.description,
          difficulty: level.difficulty,
          estimatedDurationHours: level.estimatedDurationHours,
          xpRequired: level.xpRequired,
        },
      });

      for (const node of level.nodes) {
        const codingChallenge = node.challenge
          ? {
              objective: node.challenge.objective,
              requirements: node.challenge.requirements,
              resources: node.challenge.resources,
              hints: node.challenge.hints,
              evaluationCriteria: node.challenge.evaluationCriteria,
              expectedSkills: node.challenge.expectedSkills,
            }
          : {};

        // validationRules is a field shared with the pre-existing (non-Launchpad) RoadmapNode
        // model, read by the legacy fallback pipeline (code-review.processor.ts's
        // handleEvaluation, via AIValidationService.validateSubmission) for `reviewCriteria`
        // and `weights.auto/ai` — that fallback only runs for Launchpad nodes whose technology
        // ISN'T Verification-Engine-eligible (see VERIFICATION_ENGINE_FRAMEWORKS). Frontend/
        // Backend Developer (react/express) are always eligible, so this fallback never
        // actually fires for these nodes today — but the field must not sit permanently empty
        // just because it's currently unread. Mirrored here from codingChallenge.evaluationCriteria
        // — the same single source of truth the Verification Engine's blueprint uses — reshaped
        // into what the legacy consumer expects, so any future non-eligible Launchpad track
        // inherits real config instead of silently falling back to hardcoded defaults.
        // minScore/trustLevel intentionally excluded: the legacy consumer reads those from
        // evaluationConfig/trustLevel directly, not from validationRules (see code-review.processor.ts).
        const validationRules = node.challenge
          ? { reviewCriteria: node.challenge.evaluationCriteria, weights: { auto: 0.4, ai: 0.6 } }
          : {};

        await tx.launchpadRoadmapNode.upsert({
          where: { technologyLevelId_nodeNumber: { technologyLevelId: levelRow.id, nodeNumber: node.nodeNumber } },
          create: {
            technologyLevelId: levelRow.id,
            nodeNumber: node.nodeNumber,
            title: node.title,
            slug: node.slug,
            description: node.description,
            learningObjectives: node.learningObjectives,
            videos: node.videos,
            officialDocs: node.officialDocs,
            notes: node.notes,
            cheatsheet: node.cheatsheet,
            codeExamples: node.codeExamples,
            quizQuestions: node.quizQuestions,
            codingChallenge,
            miniProject: node.miniProject,
            aiInterviewQuestions: node.interviewBank,
            validationRules,
            xpReward: node.xpReward,
            coinsReward: node.coinsReward,
            careerDnaImpact: node.careerDnaImpact || {},
            skillMapping: node.skillMapping,
            difficulty: node.difficulty,
            difficultyMultiplier: node.challenge?.multiplier ?? 1.0,
            trustLevel: node.trustLevel,
            verificationChallengeType: node.challenge?.challengeType ?? 'career',
            challengeType: node.challenge ? 'project' : 'guided',
            status: 'published',
            publishedAt: new Date(),
          },
          update: {
            title: node.title,
            description: node.description,
            learningObjectives: node.learningObjectives,
            videos: node.videos,
            officialDocs: node.officialDocs,
            notes: node.notes,
            cheatsheet: node.cheatsheet,
            codeExamples: node.codeExamples,
            quizQuestions: node.quizQuestions,
            codingChallenge,
            miniProject: node.miniProject,
            aiInterviewQuestions: node.interviewBank,
            validationRules,
            xpReward: node.xpReward,
            coinsReward: node.coinsReward,
            careerDnaImpact: node.careerDnaImpact || {},
            skillMapping: node.skillMapping,
            difficulty: node.difficulty,
            difficultyMultiplier: node.challenge?.multiplier ?? 1.0,
            trustLevel: node.trustLevel,
            verificationChallengeType: node.challenge?.challengeType ?? 'career',
            // challengeVersion is intentionally NOT bumped on every reseed — only bump it by
            // hand when a challenge's requirements/evaluationCriteria actually change, since
            // bumping invalidates every in-flight student's blueprint comparison (Part 7).
          },
        });
      }
    });
  }
}
