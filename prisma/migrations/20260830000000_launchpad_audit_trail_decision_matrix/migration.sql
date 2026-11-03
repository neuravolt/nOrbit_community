-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "newVersion" INTEGER,
ADD COLUMN     "oldVersion" INTEGER,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "challenge_evaluation_reports" ADD COLUMN     "decision" TEXT,
ADD COLUMN     "github_commit_sha" TEXT,
ADD COLUMN     "override_decision" TEXT;

-- AlterTable
ALTER TABLE "challenge_score_versions" ADD COLUMN     "category_scores" JSONB,
ADD COLUMN     "critical_gates_passed" BOOLEAN,
ADD COLUMN     "decision" TEXT,
ADD COLUMN     "failed_gates" JSONB,
ADD COLUMN     "verification_confidence" TEXT;
