-- AlterTable
ALTER TABLE "launchpad_roadmap_nodes" ADD COLUMN "evaluation_config" JSONB,
ADD COLUMN "trust_level" TEXT NOT NULL DEFAULT 'A',
ADD COLUMN "challenge_type" TEXT NOT NULL DEFAULT 'guided',
ADD COLUMN "max_attempts" INTEGER;

-- AlterTable
ALTER TABLE "launchpad_student_node_progress" ADD COLUMN "milestones" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "latest_report_id" TEXT,
ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "challenge_test_suites" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "test_code" TEXT NOT NULL,
    "timeout_sec" INTEGER NOT NULL DEFAULT 30,
    "points" INTEGER NOT NULL DEFAULT 10,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_test_suites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_evaluation_reports" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "stage_results" JSONB NOT NULL DEFAULT '[]',
    "final_score" DOUBLE PRECISION,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "auto_approved" BOOLEAN NOT NULL DEFAULT false,
    "mentor_review_req" BOOLEAN NOT NULL DEFAULT false,
    "mentor_status" TEXT,
    "ai_score" DOUBLE PRECISION,
    "ai_feedback" JSONB,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "peer_reviewer_id" TEXT,
    "peer_review_score" DOUBLE PRECISION,
    "peer_feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_evaluation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peer_review_assignments" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "evaluator_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "feedback" TEXT,
    "reward_points" INTEGER NOT NULL DEFAULT 0,
    "reward_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "peer_review_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "challenge_test_suites_node_id_idx" ON "challenge_test_suites"("node_id");

-- CreateIndex
CREATE INDEX "challenge_evaluation_reports_node_id_idx" ON "challenge_evaluation_reports"("node_id");

-- CreateIndex
CREATE INDEX "challenge_evaluation_reports_student_id_idx" ON "challenge_evaluation_reports"("student_id");

-- CreateIndex
-- AddForeignKey
ALTER TABLE "challenge_test_suites" ADD CONSTRAINT "challenge_test_suites_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "launchpad_roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_evaluation_reports" ADD CONSTRAINT "challenge_evaluation_reports_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "launchpad_roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
