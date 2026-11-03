-- CreateTable
CREATE TABLE "payment_gateway_accounts" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'CASHFREE',
    "name" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "app_id" TEXT NOT NULL,
    "secret_key_enc" TEXT NOT NULL,
    "webhook_secret_enc" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_gateway_accounts_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "payment_attempts" ADD COLUMN "gateway_account_id" TEXT,
ADD COLUMN "environment" TEXT DEFAULT 'production';

-- CreateIndex
CREATE INDEX "payment_gateway_accounts_provider_environment_is_enabled_idx" ON "payment_gateway_accounts"("provider", "environment", "is_enabled");

-- CreateIndex
CREATE INDEX "payment_attempts_gateway_account_id_idx" ON "payment_attempts"("gateway_account_id");

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_gateway_account_id_fkey" FOREIGN KEY ("gateway_account_id") REFERENCES "payment_gateway_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
