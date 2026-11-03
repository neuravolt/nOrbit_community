-- Replace the fragile technologySlug+topic (free-text) match with a real FK to the curriculum's
-- own LaunchpadTopic row. Nullable + ON DELETE SET NULL: existing rows are backfilled by a
-- follow-up data migration (matching on the current topic string), and a topic can still be
-- deleted later without cascading into a template that references it.
ALTER TABLE "challenge_templates" ADD COLUMN "topic_id" TEXT;

CREATE INDEX "challenge_templates_topic_id_idx" ON "challenge_templates"("topic_id");

ALTER TABLE "challenge_templates" ADD CONSTRAINT "challenge_templates_topic_id_fkey"
  FOREIGN KEY ("topic_id") REFERENCES "launchpad_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
