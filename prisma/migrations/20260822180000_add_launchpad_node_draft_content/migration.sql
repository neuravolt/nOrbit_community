-- Additive & Non-Destructive Migration DDL for Phase 1B (Node Versioning & Content Freezing).
-- Adds exactly one nullable column. No existing column touched, no default requiring backfill,
-- no data migration. All existing LaunchpadRoadmapNode rows get draft_content = NULL, which is
-- the exact "no pending draft" state they are already in. Guarantees existing production data
-- is 100% preserved.

ALTER TABLE "launchpad_roadmap_nodes"
  ADD COLUMN IF NOT EXISTS "draft_content" JSONB;
