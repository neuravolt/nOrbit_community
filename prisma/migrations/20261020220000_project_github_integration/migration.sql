-- Migration: 20261020220000_project_github_integration
-- Description: Additive Enterprise GitHub integration for Projects, Tasks, Multi-PR tracking, Webhook delivery idempotency, and Release Notes.

-- 1. Create WebhookProcessingStatus enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WebhookProcessingStatus') THEN
        CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');
    END IF;
END $$;

-- 2. Add additive columns to Project table
ALTER TABLE "Project" 
    ADD COLUMN IF NOT EXISTS "key" TEXT,
    ADD COLUMN IF NOT EXISTS "github_repo" TEXT,
    ADD COLUMN IF NOT EXISTS "github_repo_id" TEXT,
    ADD COLUMN IF NOT EXISTS "github_installation_id" TEXT,
    ADD COLUMN IF NOT EXISTS "github_default_branch" TEXT DEFAULT 'main';

CREATE UNIQUE INDEX IF NOT EXISTS "Project_key_key" ON "Project"("key");

-- 3. Create project_task_counters table
CREATE TABLE IF NOT EXISTS "project_task_counters" (
    "project_id" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "project_task_counters_pkey" PRIMARY KEY ("project_id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'project_task_counters_project_id_fkey'
    ) THEN
        ALTER TABLE "project_task_counters" 
            ADD CONSTRAINT "project_task_counters_project_id_fkey" 
            FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. Add additive columns to Task table
ALTER TABLE "Task"
    ADD COLUMN IF NOT EXISTS "task_code" TEXT,
    ADD COLUMN IF NOT EXISTS "github_branch" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Task_task_code_key" ON "Task"("task_code");
CREATE INDEX IF NOT EXISTS "Task_projectId_task_code_idx" ON "Task"("projectId", "task_code");

-- 5. Create task_pull_requests table
CREATE TABLE IF NOT EXISTS "task_pull_requests" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "pr_title" TEXT NOT NULL,
    "pr_url" TEXT NOT NULL,
    "repo_full_name" TEXT NOT NULL,
    "repo_id" TEXT NOT NULL,
    "head_branch" TEXT NOT NULL,
    "base_branch" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "is_merged" BOOLEAN NOT NULL DEFAULT false,
    "merged_at" TIMESTAMP(3),
    "author_login" TEXT,
    "author_avatar_url" TEXT,
    "ci_status" TEXT DEFAULT 'PENDING',
    "review_status" TEXT DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "task_pull_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "task_pull_requests_task_id_repo_full_name_pr_number_key" 
    ON "task_pull_requests"("task_id", "repo_full_name", "pr_number");
CREATE INDEX IF NOT EXISTS "task_pull_requests_repo_full_name_pr_number_idx" 
    ON "task_pull_requests"("repo_full_name", "pr_number");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'task_pull_requests_task_id_fkey'
    ) THEN
        ALTER TABLE "task_pull_requests" 
            ADD CONSTRAINT "task_pull_requests_task_id_fkey" 
            FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 6. Update github_webhooks table
ALTER TABLE "github_webhooks"
    ADD COLUMN IF NOT EXISTS "delivery_id" TEXT,
    ADD COLUMN IF NOT EXISTS "status" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    ADD COLUMN IF NOT EXISTS "retry_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "error_message" TEXT,
    ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "github_webhooks_delivery_id_key" ON "github_webhooks"("delivery_id");
CREATE INDEX IF NOT EXISTS "github_webhooks_status_received_at_idx" ON "github_webhooks"("status", "received_at");

-- 7. Create project_release_notes table
CREATE TABLE IF NOT EXISTS "project_release_notes" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "published_by_id" TEXT,
    "linked_task_ids" TEXT[] NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_release_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "project_release_notes_project_id_is_published_idx" 
    ON "project_release_notes"("project_id", "is_published");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'project_release_notes_project_id_fkey'
    ) THEN
        ALTER TABLE "project_release_notes" 
            ADD CONSTRAINT "project_release_notes_project_id_fkey" 
            FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'project_release_notes_published_by_id_fkey'
    ) THEN
        ALTER TABLE "project_release_notes" 
            ADD CONSTRAINT "project_release_notes_published_by_id_fkey" 
            FOREIGN KEY ("published_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
