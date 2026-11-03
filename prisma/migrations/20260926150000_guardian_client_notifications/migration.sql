-- CreateTable
CREATE TABLE "guardian_client_notification_preferences" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "telegram_chat_id" TEXT,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardian_client_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_client_push_subscriptions" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "guardian_client_push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guardian_client_notification_preferences_client_id_key" ON "guardian_client_notification_preferences"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_client_push_subscriptions_endpoint_key" ON "guardian_client_push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "guardian_client_push_subscriptions_client_id_idx" ON "guardian_client_push_subscriptions"("client_id");

-- AddForeignKey
ALTER TABLE "guardian_client_notification_preferences" ADD CONSTRAINT "guardian_client_notification_preferences_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_client_push_subscriptions" ADD CONSTRAINT "guardian_client_push_subscriptions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

