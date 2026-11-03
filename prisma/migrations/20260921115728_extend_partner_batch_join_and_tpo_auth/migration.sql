-- CreateEnum
CREATE TYPE "LaunchpadBatchJoinMode" AS ENUM ('AUTO', 'APPROVAL_REQUIRED');

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "partner_user_id" TEXT;

-- AlterTable
ALTER TABLE "launchpad_batches" ADD COLUMN     "join_code" TEXT,
ADD COLUMN     "join_mode" "LaunchpadBatchJoinMode" DEFAULT 'AUTO';

-- AlterTable
ALTER TABLE "launchpad_partner_users" ADD COLUMN     "email" TEXT,
ADD COLUMN     "full_name" TEXT,
ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "temp_password_expires_at" TIMESTAMP(3),
ADD COLUMN     "token_version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "launchpad_batches_join_code_key" ON "launchpad_batches"("join_code");

-- CreateIndex
CREATE UNIQUE INDEX "launchpad_partner_users_email_key" ON "launchpad_partner_users"("email");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_partner_user_id_fkey" FOREIGN KEY ("partner_user_id") REFERENCES "launchpad_partner_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launchpad_batch_enrollments" ADD CONSTRAINT "launchpad_batch_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "launchpad_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
