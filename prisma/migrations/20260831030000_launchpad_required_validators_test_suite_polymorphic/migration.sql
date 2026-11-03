-- Phase C1 (Contract-driven dynamic validator selection): requiredValidators on the contract.
ALTER TABLE "launchpad_challenge_verification_contracts" ADD COLUMN "required_validators" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Phase C3 (Full-pipeline self-test): ChallengeTestSuite becomes polymorphic, same
-- targetType/targetId convention already used across this schema. node_id becomes nullable;
-- existing rows are backfilled to targetType='roadmap_node', targetId=<their node_id>.
ALTER TABLE "challenge_test_suites" ALTER COLUMN "node_id" DROP NOT NULL;
ALTER TABLE "challenge_test_suites" ADD COLUMN "target_type" TEXT NOT NULL DEFAULT 'roadmap_node';
ALTER TABLE "challenge_test_suites" ADD COLUMN "target_id" TEXT;

UPDATE "challenge_test_suites" SET "target_id" = "node_id" WHERE "target_id" IS NULL;

CREATE INDEX "challenge_test_suites_target_type_target_id_idx" ON "challenge_test_suites"("target_type", "target_id");
