-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertType" ADD VALUE 'SSL_DOMAIN_MISMATCH';
ALTER TYPE "AlertType" ADD VALUE 'DNS_DRIFT';
ALTER TYPE "AlertType" ADD VALUE 'SENSITIVE_FILE_EXPOSED';
ALTER TYPE "AlertType" ADD VALUE 'SECURITY_BACKDOOR_FOUND';

-- CreateTable
CREATE TABLE "guardian_domain_observations" (
    "id" TEXT NOT NULL,
    "website_id" TEXT NOT NULL,
    "resolved_record_type" TEXT NOT NULL,
    "resolved_values" JSONB NOT NULL,
    "endpoint_model" TEXT,
    "expected_ip" TEXT,
    "drift_detected" BOOLEAN NOT NULL DEFAULT false,
    "drift_reason" TEXT,
    "nameservers" JSONB,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_domain_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_tls_observations" (
    "id" TEXT NOT NULL,
    "website_id" TEXT NOT NULL,
    "resolved_sans" JSONB NOT NULL,
    "hostname_match" BOOLEAN NOT NULL,
    "issuer" TEXT,
    "subject" TEXT,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "days_until_expiry" INTEGER,
    "is_parking_page" BOOLEAN NOT NULL DEFAULT false,
    "parking_page_confidence" INTEGER,
    "tls_protocol" TEXT,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_message" TEXT,

    CONSTRAINT "guardian_tls_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_security_findings" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "source" TEXT NOT NULL,
    "finding_type" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "confidence_score" INTEGER NOT NULL DEFAULT 100,
    "evidence" JSONB NOT NULL,
    "file_path" TEXT,
    "url" TEXT,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "dismissed_reason" TEXT,

    CONSTRAINT "guardian_security_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_fleet_operations" (
    "id" TEXT NOT NULL,
    "initiated_by" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "payload" JSONB,
    "idempotency_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "total_targets" INTEGER NOT NULL DEFAULT 0,
    "succeeded_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "guardian_fleet_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_fleet_operation_targets" (
    "id" TEXT NOT NULL,
    "fleet_operation_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "guardian_fleet_operation_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guardian_domain_observations_website_id_checked_at_idx" ON "guardian_domain_observations"("website_id", "checked_at");

-- CreateIndex
CREATE INDEX "guardian_domain_observations_website_id_drift_detected_idx" ON "guardian_domain_observations"("website_id", "drift_detected");

-- CreateIndex
CREATE INDEX "guardian_tls_observations_website_id_checked_at_idx" ON "guardian_tls_observations"("website_id", "checked_at");

-- CreateIndex
CREATE INDEX "guardian_tls_observations_website_id_hostname_match_idx" ON "guardian_tls_observations"("website_id", "hostname_match");

-- CreateIndex
CREATE INDEX "guardian_security_findings_asset_id_status_idx" ON "guardian_security_findings"("asset_id", "status");

-- CreateIndex
CREATE INDEX "guardian_security_findings_asset_id_fingerprint_status_idx" ON "guardian_security_findings"("asset_id", "fingerprint", "status");

-- CreateIndex
CREATE INDEX "guardian_security_findings_agent_id_idx" ON "guardian_security_findings"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_fleet_operations_idempotency_key_key" ON "guardian_fleet_operations"("idempotency_key");

-- CreateIndex
CREATE INDEX "guardian_fleet_operations_status_created_at_idx" ON "guardian_fleet_operations"("status", "created_at");

-- CreateIndex
CREATE INDEX "guardian_fleet_operation_targets_agent_id_idx" ON "guardian_fleet_operation_targets"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_fleet_operation_targets_fleet_operation_id_agent_i_key" ON "guardian_fleet_operation_targets"("fleet_operation_id", "agent_id");

-- AddForeignKey
ALTER TABLE "guardian_domain_observations" ADD CONSTRAINT "guardian_domain_observations_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_tls_observations" ADD CONSTRAINT "guardian_tls_observations_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_security_findings" ADD CONSTRAINT "guardian_security_findings_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_security_findings" ADD CONSTRAINT "guardian_security_findings_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "guardian_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_fleet_operation_targets" ADD CONSTRAINT "guardian_fleet_operation_targets_fleet_operation_id_fkey" FOREIGN KEY ("fleet_operation_id") REFERENCES "guardian_fleet_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_fleet_operation_targets" ADD CONSTRAINT "guardian_fleet_operation_targets_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "guardian_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

