-- CreateTable
CREATE TABLE IF NOT EXISTS "collect_webhook_deliveries" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "destination_url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "last_status_code" INTEGER,
    "last_error" TEXT,
    "next_retry_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collect_webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "collect_webhook_deliveries_event_id_key" ON "collect_webhook_deliveries"("event_id");
CREATE INDEX IF NOT EXISTS "collect_webhook_deliveries_app_id_status_idx" ON "collect_webhook_deliveries"("app_id", "status");
CREATE INDEX IF NOT EXISTS "collect_webhook_deliveries_status_next_retry_at_idx" ON "collect_webhook_deliveries"("status", "next_retry_at");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'collect_webhook_deliveries_app_id_fkey'
    ) THEN
        ALTER TABLE "collect_webhook_deliveries" ADD CONSTRAINT "collect_webhook_deliveries_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "collect_apps"("app_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
