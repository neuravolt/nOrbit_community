-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertType" ADD VALUE 'WP_ROGUE_ADMIN';
ALTER TYPE "AlertType" ADD VALUE 'WP_SUSPICIOUS_FILE';
ALTER TYPE "AlertType" ADD VALUE 'WP_DB_BLOAT';

-- CreateTable
CREATE TABLE "guardian_wordpress_scans" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "assetId" TEXT,
    "domain" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "admin_users" JSONB NOT NULL,
    "new_admins_since_last_scan" JSONB NOT NULL DEFAULT '[]',
    "suspicious_admin_accounts" JSONB NOT NULL DEFAULT '[]',
    "mu_plugin_files" JSONB NOT NULL DEFAULT '[]',
    "new_or_changed_mu_plugin_files" JSONB NOT NULL DEFAULT '[]',
    "suspicious_upload_php_files" JSONB NOT NULL DEFAULT '[]',
    "db_bloat_findings" JSONB NOT NULL DEFAULT '[]',
    "overall_status" TEXT NOT NULL,
    "error_message" TEXT,

    CONSTRAINT "guardian_wordpress_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guardian_wordpress_scans_agent_id_domain_scanned_at_idx" ON "guardian_wordpress_scans"("agent_id", "domain", "scanned_at");

-- CreateIndex
CREATE INDEX "guardian_wordpress_scans_assetId_idx" ON "guardian_wordpress_scans"("assetId");

-- AddForeignKey
ALTER TABLE "guardian_wordpress_scans" ADD CONSTRAINT "guardian_wordpress_scans_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "guardian_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_wordpress_scans" ADD CONSTRAINT "guardian_wordpress_scans_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

