-- AlterTable
ALTER TABLE "challenge_test_suites" ADD COLUMN     "challenge_version" INTEGER,
ADD COLUMN     "generation_job_id" TEXT,
ADD COLUMN     "review_status" TEXT NOT NULL DEFAULT 'approved';

