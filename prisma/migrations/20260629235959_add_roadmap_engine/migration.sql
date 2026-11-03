-- CreateTable
CREATE TABLE "launchpad_careers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT DEFAULT '#3B82F6',
    "sort_order" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launchpad_careers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launchpad_career_roles" (
    "id" TEXT NOT NULL,
    "career_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launchpad_career_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launchpad_technologies" (
    "id" TEXT NOT NULL,
    "career_role_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "default_stack" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launchpad_technologies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launchpad_technology_levels" (
    "id" TEXT NOT NULL,
    "technology_id" TEXT NOT NULL,
    "level_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "xp_required" INTEGER NOT NULL DEFAULT 0,
    "estimated_duration_hours" INTEGER NOT NULL DEFAULT 40,
    "difficulty" TEXT NOT NULL DEFAULT 'beginner',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launchpad_technology_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launchpad_roadmap_nodes" (
    "id" TEXT NOT NULL,
    "technology_level_id" TEXT NOT NULL,
    "node_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "learning_objectives" JSONB NOT NULL,
    "videos" JSONB NOT NULL,
    "official_docs" JSONB NOT NULL,
    "notes" TEXT NOT NULL,
    "cheatsheet" TEXT NOT NULL,
    "code_examples" JSONB NOT NULL,
    "quiz_questions" JSONB NOT NULL,
    "coding_challenge" JSONB NOT NULL,
    "mini_project" JSONB NOT NULL,
    "ai_interview_questions" JSONB NOT NULL,
    "validation_rules" JSONB NOT NULL,
    "xp_reward" INTEGER NOT NULL DEFAULT 100,
    "coins_reward" INTEGER NOT NULL DEFAULT 50,
    "career_dna_impact" JSONB NOT NULL,
    "skill_mapping" JSONB NOT NULL,
    "estimated_duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "difficulty" TEXT NOT NULL DEFAULT 'beginner',
    "prerequisites" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launchpad_roadmap_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launchpad_student_technology_progress" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "technology_id" TEXT NOT NULL,
    "current_level" INTEGER NOT NULL DEFAULT 1,
    "current_node" INTEGER NOT NULL DEFAULT 1,
    "overall_progress_percent" INTEGER NOT NULL DEFAULT 0,
    "mastery_score" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "launchpad_student_technology_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launchpad_student_node_progress" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'locked',
    "quiz_score" INTEGER,
    "challenge_submission_url" TEXT,
    "ai_review_score" INTEGER,
    "ai_review_feedback" TEXT,
    "mentor_review_status" TEXT,
    "mentor_review_notes" TEXT,
    "evidence_id" TEXT,
    "xp_awarded" INTEGER NOT NULL DEFAULT 0,
    "coins_awarded" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quiz_completed_at" TIMESTAMP(3),
    "challenge_submitted_at" TIMESTAMP(3),
    "ai_verified_at" TIMESTAMP(3),
    "mentor_approved_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "launchpad_student_node_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launchpad_ai_prompts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "prompt_template" TEXT NOT NULL,
    "model_config" JSONB NOT NULL,
    "output_schema" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launchpad_ai_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launchpad_ai_generation_jobs" (
    "id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "bullmq_job_id" TEXT,
    "input_data" JSONB,
    "output_data" JSONB,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "review_status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launchpad_ai_generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launchpad_github_roadmap_repos" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "repo_name" TEXT NOT NULL,
    "repo_url" TEXT NOT NULL,
    "organization_name" TEXT NOT NULL,
    "template_repository" TEXT,
    "default_branch" TEXT NOT NULL DEFAULT 'main',
    "protected_branches" BOOLEAN NOT NULL DEFAULT true,
    "generated_issues" JSONB NOT NULL,
    "generated_milestones" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launchpad_github_roadmap_repos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "launchpad_careers_name_key" ON "launchpad_careers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "launchpad_careers_slug_key" ON "launchpad_careers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "launchpad_career_roles_slug_key" ON "launchpad_career_roles"("slug");

-- CreateIndex
CREATE INDEX "launchpad_career_roles_career_id_idx" ON "launchpad_career_roles"("career_id");

-- CreateIndex
CREATE UNIQUE INDEX "launchpad_technologies_slug_key" ON "launchpad_technologies"("slug");

-- CreateIndex
CREATE INDEX "launchpad_technologies_career_role_id_idx" ON "launchpad_technologies"("career_role_id");

-- CreateIndex
CREATE INDEX "launchpad_technology_levels_technology_id_idx" ON "launchpad_technology_levels"("technology_id");

-- CreateIndex
CREATE UNIQUE INDEX "launchpad_technology_levels_technology_id_level_number_key" ON "launchpad_technology_levels"("technology_id", "level_number");

-- CreateIndex
CREATE INDEX "launchpad_roadmap_nodes_technology_level_id_idx" ON "launchpad_roadmap_nodes"("technology_level_id");

-- CreateIndex
CREATE UNIQUE INDEX "launchpad_roadmap_nodes_technology_level_id_node_number_key" ON "launchpad_roadmap_nodes"("technology_level_id", "node_number");

-- CreateIndex
CREATE INDEX "launchpad_student_technology_progress_student_id_idx" ON "launchpad_student_technology_progress"("student_id");

-- CreateIndex
CREATE INDEX "launchpad_student_technology_progress_technology_id_idx" ON "launchpad_student_technology_progress"("technology_id");

-- CreateIndex
CREATE UNIQUE INDEX "launchpad_student_technology_progress_student_id_technology_key" ON "launchpad_student_technology_progress"("student_id", "technology_id");

-- CreateIndex
CREATE INDEX "launchpad_student_node_progress_student_id_idx" ON "launchpad_student_node_progress"("student_id");

-- CreateIndex
CREATE INDEX "launchpad_student_node_progress_node_id_idx" ON "launchpad_student_node_progress"("node_id");

-- CreateIndex
CREATE INDEX "launchpad_student_node_progress_evidence_id_idx" ON "launchpad_student_node_progress"("evidence_id");

-- CreateIndex
CREATE UNIQUE INDEX "launchpad_student_node_progress_student_id_node_id_key" ON "launchpad_student_node_progress"("student_id", "node_id");

-- CreateIndex
CREATE UNIQUE INDEX "launchpad_ai_prompts_name_key" ON "launchpad_ai_prompts"("name");

-- CreateIndex
CREATE INDEX "launchpad_ai_generation_jobs_target_id_idx" ON "launchpad_ai_generation_jobs"("target_id");

-- CreateIndex
CREATE INDEX "launchpad_github_roadmap_repos_node_id_idx" ON "launchpad_github_roadmap_repos"("node_id");

-- CreateIndex
CREATE UNIQUE INDEX "launchpad_github_roadmap_repos_node_id_repo_name_key" ON "launchpad_github_roadmap_repos"("node_id", "repo_name");

-- AddForeignKey
ALTER TABLE "launchpad_career_roles" ADD CONSTRAINT "launchpad_career_roles_career_id_fkey" FOREIGN KEY ("career_id") REFERENCES "launchpad_careers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launchpad_technologies" ADD CONSTRAINT "launchpad_technologies_career_role_id_fkey" FOREIGN KEY ("career_role_id") REFERENCES "launchpad_career_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launchpad_technology_levels" ADD CONSTRAINT "launchpad_technology_levels_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "launchpad_technologies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launchpad_roadmap_nodes" ADD CONSTRAINT "launchpad_roadmap_nodes_technology_level_id_fkey" FOREIGN KEY ("technology_level_id") REFERENCES "launchpad_technology_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launchpad_student_technology_progress" ADD CONSTRAINT "launchpad_student_technology_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "launchpad_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launchpad_student_technology_progress" ADD CONSTRAINT "launchpad_student_technology_progress_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "launchpad_technologies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launchpad_student_node_progress" ADD CONSTRAINT "launchpad_student_node_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "launchpad_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launchpad_student_node_progress" ADD CONSTRAINT "launchpad_student_node_progress_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "launchpad_roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launchpad_student_node_progress" ADD CONSTRAINT "launchpad_student_node_progress_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "launchpad_evidence_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launchpad_ai_generation_jobs" ADD CONSTRAINT "ai_jobs_target_node_fk" FOREIGN KEY ("target_id") REFERENCES "launchpad_roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launchpad_github_roadmap_repos" ADD CONSTRAINT "launchpad_github_roadmap_repos_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "launchpad_roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
