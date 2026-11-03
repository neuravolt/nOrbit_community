-- Phase C3 (Full-pipeline self-test): rollup column for BrokenSolutionsValidationService's
-- runFullPipelineSelfTest, separate from the pre-existing hidden-tests-only test_validation_result.
ALTER TABLE "launchpad_challenge_verification_contracts" ADD COLUMN "self_test_result" JSONB;
