-- AlterTable
ALTER TABLE "launchpad_ai_generation_jobs" ADD COLUMN     "generation_run_id" TEXT;

-- CreateTable
CREATE TABLE "launchpad_curriculum_generation_runs" (
    "id" TEXT NOT NULL,
    "technology_level_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "current_stage" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "launchpad_curriculum_generation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "launchpad_curriculum_generation_runs_technology_level_id_idx" ON "launchpad_curriculum_generation_runs"("technology_level_id");

-- CreateIndex
CREATE INDEX "launchpad_ai_generation_jobs_generation_run_id_idx" ON "launchpad_ai_generation_jobs"("generation_run_id");

-- AddForeignKey
ALTER TABLE "launchpad_curriculum_generation_runs" ADD CONSTRAINT "launchpad_curriculum_generation_runs_technology_level_id_fkey" FOREIGN KEY ("technology_level_id") REFERENCES "launchpad_technology_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launchpad_ai_generation_jobs" ADD CONSTRAINT "launchpad_ai_generation_jobs_generation_run_id_fkey" FOREIGN KEY ("generation_run_id") REFERENCES "launchpad_curriculum_generation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

