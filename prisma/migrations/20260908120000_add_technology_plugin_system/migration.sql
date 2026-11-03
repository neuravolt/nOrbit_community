-- CreateTable
CREATE TABLE "launchpad_technology_slug_aliases" (
    "id" TEXT NOT NULL,
    "alias_slug" TEXT NOT NULL,
    "technology_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "launchpad_technology_slug_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launchpad_technology_plugins" (
    "id" TEXT NOT NULL,
    "technology_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "previous_version_id" TEXT,
    "approval_status" TEXT NOT NULL DEFAULT 'draft',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "file_extensions" TEXT[],
    "requirement_patterns" JSONB NOT NULL,
    "auth_construct_pattern" TEXT NOT NULL,
    "api_response_construct_pattern" TEXT NOT NULL,
    "notable_patterns" JSONB NOT NULL DEFAULT '[]',
    "challenge_scaffold" JSONB,
    "solution_file_name" TEXT NOT NULL DEFAULT 'solution.js',
    "manifest_file_name" TEXT,
    "test_runner_kind" TEXT NOT NULL DEFAULT 'process-exec',
    "no_build_step" BOOLEAN NOT NULL DEFAULT false,
    "install_command" TEXT,
    "install_timeout_sec" INTEGER NOT NULL DEFAULT 60,
    "build_command" TEXT,
    "build_timeout_sec" INTEGER NOT NULL DEFAULT 60,
    "test_command_template" TEXT,
    "test_file_extension" TEXT NOT NULL DEFAULT '.test.js',
    "test_output_format" TEXT NOT NULL DEFAULT 'jest-json',
    "test_runner_default_timeout_sec" INTEGER NOT NULL DEFAULT 30,
    "requires_test_service" BOOLEAN NOT NULL DEFAULT false,
    "test_service_kind" TEXT,
    "infra_requirements" JSONB,
    "lint_strategy" TEXT NOT NULL DEFAULT 'regex-js-ts',
    "ast_file_extensions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ast_strategy" TEXT NOT NULL DEFAULT 'typescript-compiler-api',
    "memory_safety_enabled" BOOLEAN NOT NULL DEFAULT false,
    "memory_safety_command" TEXT,
    "concurrency_safety_enabled" BOOLEAN NOT NULL DEFAULT false,
    "concurrency_safety_command" TEXT,
    "performance_enabled" BOOLEAN NOT NULL DEFAULT false,
    "performance_input_sizes" JSONB,
    "performance_time_limits_ms" JSONB,
    "performance_command_template" TEXT,
    "mutation_testing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mutation_testing_command" TEXT,
    "mutation_testing_min_score" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "type_checking_enabled" BOOLEAN NOT NULL DEFAULT false,
    "type_checking_command" TEXT,
    "type_checking_blocking" BOOLEAN NOT NULL DEFAULT false,
    "dangerous_patterns" JSONB NOT NULL DEFAULT '[]',
    "score_component_weights" JSONB NOT NULL,
    "hidden_test_framework_name" TEXT NOT NULL,
    "hidden_test_prompt_notes" TEXT,
    "docker_image" TEXT NOT NULL,
    "memory_limit_mb" INTEGER NOT NULL DEFAULT 512,
    "cpu_limit" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "launchpad_technology_plugins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "launchpad_technology_slug_aliases_alias_slug_key" ON "launchpad_technology_slug_aliases"("alias_slug");

-- CreateIndex
CREATE INDEX "launchpad_technology_slug_aliases_technology_id_idx" ON "launchpad_technology_slug_aliases"("technology_id");

-- CreateIndex
CREATE INDEX "launchpad_technology_plugins_technology_id_approval_status_idx" ON "launchpad_technology_plugins"("technology_id", "approval_status");

-- CreateIndex
CREATE UNIQUE INDEX "launchpad_technology_plugins_technology_id_version_number_key" ON "launchpad_technology_plugins"("technology_id", "version_number");

-- AddForeignKey
ALTER TABLE "launchpad_technology_slug_aliases" ADD CONSTRAINT "launchpad_technology_slug_aliases_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "launchpad_technologies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launchpad_technology_plugins" ADD CONSTRAINT "launchpad_technology_plugins_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "launchpad_technologies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

