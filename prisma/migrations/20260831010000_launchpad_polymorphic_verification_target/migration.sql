-- Phase A (Roadmap): generalize the Verification Engine's target from LaunchpadRoadmapNode-only
-- to a polymorphic target (roadmap_node | launchpad_task), mirroring the existing
-- LaunchpadAiGenerationJob.target_type/target_id pattern already used elsewhere in this schema.

-- ChallengeEvaluationReport: node_id becomes nullable (kept, real FK, populated only for
-- roadmap_node targets); add target_type/target_id (no FK, loose reference).
ALTER TABLE "challenge_evaluation_reports" ALTER COLUMN "node_id" DROP NOT NULL;
ALTER TABLE "challenge_evaluation_reports" ADD COLUMN "target_type" TEXT NOT NULL DEFAULT 'roadmap_node';
ALTER TABLE "challenge_evaluation_reports" ADD COLUMN "target_id" TEXT;
ALTER TABLE "challenge_evaluation_reports" ADD COLUMN "task_submission_id" TEXT;
CREATE INDEX "challenge_evaluation_reports_studentId_targetType_targetId_idx" ON "challenge_evaluation_reports" ("student_id", "target_type", "target_id");
UPDATE "challenge_evaluation_reports" SET "target_type" = 'roadmap_node', "target_id" = "node_id" WHERE "node_id" IS NOT NULL AND "target_id" IS NULL;

-- LaunchpadTask: coding_challenge field for CODE-proof-type tasks (mirrors LaunchpadRoadmapNode.coding_challenge).
ALTER TABLE "launchpad_tasks" ADD COLUMN "coding_challenge" JSONB;

-- LaunchpadChallengeVerificationContract: same polymorphic target generalization, plus explicit
-- versioning (version_number/previous_version_id) so upsertDraft can create a new row per change
-- instead of mutating the latest one in place.
ALTER TABLE "launchpad_challenge_verification_contracts" ALTER COLUMN "node_id" DROP NOT NULL;
ALTER TABLE "launchpad_challenge_verification_contracts" ADD COLUMN "target_type" TEXT NOT NULL DEFAULT 'roadmap_node';
ALTER TABLE "launchpad_challenge_verification_contracts" ADD COLUMN "target_id" TEXT;
ALTER TABLE "launchpad_challenge_verification_contracts" ADD COLUMN "version_number" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "launchpad_challenge_verification_contracts" ADD COLUMN "previous_version_id" TEXT;
CREATE INDEX "launchpad_challenge_verification_contracts_targetType_targetId_versionNumber_idx" ON "launchpad_challenge_verification_contracts" ("target_type", "target_id", "version_number");
UPDATE "launchpad_challenge_verification_contracts" SET "target_type" = 'roadmap_node', "target_id" = "node_id" WHERE "node_id" IS NOT NULL AND "target_id" IS NULL;
