-- CreateTable
CREATE TABLE "launchpad_stale_markers" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "triggered_by_version_id" TEXT NOT NULL,
    "stale_since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "professor_decision" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "launchpad_stale_markers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "launchpad_stale_markers_entity_type_entity_id_idx" ON "launchpad_stale_markers"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "launchpad_stale_markers" ADD CONSTRAINT "launchpad_stale_markers_triggered_by_version_id_fkey" FOREIGN KEY ("triggered_by_version_id") REFERENCES "launchpad_content_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

