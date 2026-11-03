-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "severity" TEXT;

-- AlterTable
ALTER TABLE "guardian_agents" ADD COLUMN     "previous_secret_hash" TEXT,
ADD COLUMN     "previous_secret_rotated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "guardian_install_tokens" ADD COLUMN     "invalid_attempts" INTEGER NOT NULL DEFAULT 0;

