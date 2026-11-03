-- Backs the nightly GuardianMonitor retention prune (guardian_monitors has 14.5M+ rows in
-- production and the only existing index is (website_id, timestamp), not usable for a plain
-- "timestamp < cutoff" filter).
CREATE INDEX IF NOT EXISTS "guardian_monitors_timestamp_idx" ON "guardian_monitors" ("timestamp");
