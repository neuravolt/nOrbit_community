-- CreateTable
CREATE TABLE "launchpad_content_versions" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT 'full',
    "version_number" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "generation_job_id" TEXT,
    "instruction" TEXT,
    "previous_version_id" TEXT,
    "reviewer_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "launchpad_content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "launchpad_content_versions_node_id_idx" ON "launchpad_content_versions"("node_id");

-- CreateIndex
CREATE INDEX "launchpad_content_versions_node_id_section_version_number_idx" ON "launchpad_content_versions"("node_id", "section", "version_number");

-- AddForeignKey
ALTER TABLE "launchpad_content_versions" ADD CONSTRAINT "launchpad_content_versions_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "launchpad_roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

