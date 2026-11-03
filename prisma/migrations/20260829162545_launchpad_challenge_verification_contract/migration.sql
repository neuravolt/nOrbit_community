-- CreateTable
CREATE TABLE "launchpad_challenge_verification_contracts" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "technology_slug" TEXT NOT NULL,
    "custom_weights" JSONB,
    "custom_gates" JSONB,
    "public_tests" JSONB,
    "expected_solution" TEXT,
    "broken_solutions" JSONB,
    "test_validation_result" JSONB,
    "approval_status" TEXT NOT NULL DEFAULT 'draft',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launchpad_challenge_verification_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "launchpad_challenge_verification_contracts_node_id_idx" ON "launchpad_challenge_verification_contracts"("node_id");

-- AddForeignKey
ALTER TABLE "launchpad_challenge_verification_contracts" ADD CONSTRAINT "launchpad_challenge_verification_contracts_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "launchpad_roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

