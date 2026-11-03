-- AlterEnum
ALTER TYPE "GuardianNotificationChannel" ADD VALUE 'TELEGRAM';

-- CreateTable
CREATE TABLE "guardian_notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "min_severity" TEXT NOT NULL DEFAULT 'INFO',
    "muted_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "telegram_chat_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardian_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guardian_notification_preferences_user_id_key" ON "guardian_notification_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "guardian_notification_preferences" ADD CONSTRAINT "guardian_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

