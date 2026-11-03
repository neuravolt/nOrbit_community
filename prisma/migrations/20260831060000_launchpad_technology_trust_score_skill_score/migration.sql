-- Phase F1 (Technology-specific Trust Score): migrate LaunchpadTrustScore off a bare
-- studentId-unique to a per-(student, technology) composite. "_overall" is a NOT-NULL sentinel
-- default (not nullable) — Postgres composite-unique semantics treat NULL as distinct-per-row,
-- which would silently defeat the new constraint. Existing rows (guaranteed unique on
-- studentId alone by the constraint being dropped) all backfill to '_overall', preserving every
-- pre-existing caller's exact behavior.
ALTER TABLE "launchpad_trust_scores" ADD COLUMN "technology_slug" TEXT NOT NULL DEFAULT '_overall';
DROP INDEX "launchpad_trust_scores_student_id_key";
CREATE UNIQUE INDEX "launchpad_trust_scores_student_id_technology_slug_key" ON "launchpad_trust_scores"("student_id", "technology_slug");

-- Phase F3 (Skill Score): a genuinely new, always technology-scoped metric — no "_overall"
-- sentinel, since "how skilled" is meaningless without a technology to be skilled AT.
CREATE TABLE "launchpad_skill_scores" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "technology_slug" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launchpad_skill_scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "launchpad_skill_scores_student_id_technology_slug_key" ON "launchpad_skill_scores"("student_id", "technology_slug");
