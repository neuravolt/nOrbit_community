-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_transactions_wallet_id_reference_id_type_key" ON "wallet_transactions"("wallet_id", "reference_id", "type");
