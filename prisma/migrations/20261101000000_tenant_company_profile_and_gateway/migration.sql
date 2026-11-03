-- AlterTable company_profile
ALTER TABLE "company_profile" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "company_profile_organization_id_key" ON "company_profile"("organization_id");

-- AddForeignKey company_profile -> Organization
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'company_profile_organization_id_fkey'
    ) THEN
        ALTER TABLE "company_profile" ADD CONSTRAINT "company_profile_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable payment_gateway_accounts
ALTER TABLE "payment_gateway_accounts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
CREATE INDEX IF NOT EXISTS "payment_gateway_accounts_organization_id_idx" ON "payment_gateway_accounts"("organization_id");

-- AddForeignKey payment_gateway_accounts -> Organization
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payment_gateway_accounts_organization_id_fkey'
    ) THEN
        ALTER TABLE "payment_gateway_accounts" ADD CONSTRAINT "payment_gateway_accounts_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
