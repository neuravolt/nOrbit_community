-- AlterEnum
ALTER TYPE "GuardianNotificationChannel" ADD VALUE 'PUSH';

-- AlterTable
ALTER TABLE "guardian_notification_preferences" ADD COLUMN     "push_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "guardian_push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "guardian_push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guardian_push_subscriptions_endpoint_key" ON "guardian_push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "guardian_push_subscriptions_user_id_idx" ON "guardian_push_subscriptions"("user_id");

-- AddForeignKey
ALTER TABLE "guardian_push_subscriptions" ADD CONSTRAINT "guardian_push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

