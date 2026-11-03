-- AlterTable
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "collect_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "collect_apps" ADD COLUMN IF NOT EXISTS "client_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "collect_apps_client_id_idx" ON "collect_apps"("client_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'collect_apps_client_id_fkey'
    ) THEN
        ALTER TABLE "collect_apps" ADD CONSTRAINT "collect_apps_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable: client_wallets
CREATE TABLE IF NOT EXISTS "client_wallets" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "available_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pending_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lifetime_collected" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lifetime_paid_out" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_wallets_client_id_key" ON "client_wallets"("client_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'client_wallets_client_id_fkey'
    ) THEN
        ALTER TABLE "client_wallets" ADD CONSTRAINT "client_wallets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable: wallet_transactions
CREATE TABLE IF NOT EXISTS "wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "reference_id" TEXT,
    "description" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at");
CREATE INDEX IF NOT EXISTS "wallet_transactions_reference_id_idx" ON "wallet_transactions"("reference_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'wallet_transactions_wallet_id_fkey'
    ) THEN
        ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "client_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable: client_bank_accounts
CREATE TABLE IF NOT EXISTS "client_bank_accounts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "account_holder_name" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number_enc" TEXT NOT NULL,
    "account_number_masked" TEXT NOT NULL,
    "ifsc_code" TEXT NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "client_bank_accounts_client_id_idx" ON "client_bank_accounts"("client_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'client_bank_accounts_client_id_fkey'
    ) THEN
        ALTER TABLE "client_bank_accounts" ADD CONSTRAINT "client_bank_accounts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable: payout_requests
CREATE TABLE IF NOT EXISTS "payout_requests" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "utr_number" TEXT,
    "processed_by_user_id" TEXT,
    "processed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payout_requests_wallet_id_status_idx" ON "payout_requests"("wallet_id", "status");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payout_requests_wallet_id_fkey'
    ) THEN
        ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "client_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payout_requests_bank_account_id_fkey'
    ) THEN
        ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "client_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
