-- AlterTable
ALTER TABLE "payment_attempts" ALTER COLUMN "invoice_id" DROP NOT NULL,
ALTER COLUMN "client_id" DROP NOT NULL,
ADD COLUMN "app_id" TEXT,
ADD COLUMN "external_order_id" TEXT;

-- CreateIndex
CREATE INDEX "payment_attempts_app_id_external_order_id_idx" ON "payment_attempts"("app_id", "external_order_id");

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "collect_apps"("app_id") ON DELETE SET NULL ON UPDATE CASCADE;
