-- Phase B1 (Roadmap Runtime Verification Architecture): Challenge Template + Instance Engine.
-- Additive only: existing 1:1 codingChallenge JSON flow on LaunchpadRoadmapNode/LaunchpadTask
-- is untouched; instanceId columns below are nullable loose references, same style targetId
-- already uses across this schema.

-- CreateTable
CREATE TABLE "challenge_templates" (
    "id" TEXT NOT NULL,
    "technology_slug" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "learning_objective" TEXT NOT NULL,
    "requirements" JSONB NOT NULL DEFAULT '[]',
    "evaluation_criteria" JSONB NOT NULL DEFAULT '[]',
    "parameter_schema" JSONB NOT NULL,
    "template_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "previous_version_id" TEXT,
    "created_by_source" TEXT NOT NULL DEFAULT 'MANUAL',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_instances" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL DEFAULT 'roadmap_node',
    "target_id" TEXT,
    "student_id" TEXT,
    "parameters" JSONB NOT NULL,
    "instance_hash" TEXT NOT NULL,
    "problem_statement" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "challenge_templates_template_hash_key" ON "challenge_templates"("template_hash");

-- CreateIndex
CREATE INDEX "challenge_templates_technology_slug_topic_idx" ON "challenge_templates"("technology_slug", "topic");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_instances_instance_hash_key" ON "challenge_instances"("instance_hash");

-- CreateIndex
CREATE INDEX "challenge_instances_template_id_idx" ON "challenge_instances"("template_id");

-- CreateIndex
CREATE INDEX "challenge_instances_target_type_target_id_idx" ON "challenge_instances"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "challenge_instances_student_id_idx" ON "challenge_instances"("student_id");

-- AddForeignKey
ALTER TABLE "challenge_instances" ADD CONSTRAINT "challenge_instances_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "challenge_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: loose instanceId reference on the existing verification contract
ALTER TABLE "launchpad_challenge_verification_contracts" ADD COLUMN "instance_id" TEXT;

-- AlterTable: loose instanceId reference on the existing evaluation report
ALTER TABLE "challenge_evaluation_reports" ADD COLUMN "instance_id" TEXT;
