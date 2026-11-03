-- AlterTable
ALTER TABLE "company_profile" ADD COLUMN     "active_online_gateway" TEXT NOT NULL DEFAULT 'CASHFREE',
ADD COLUMN     "cashfree_app_id" TEXT,
ADD COLUMN     "cashfree_environment" TEXT NOT NULL DEFAULT 'sandbox',
ADD COLUMN     "cashfree_secret_key_enc" TEXT,
ADD COLUMN     "cashfree_webhook_secret_enc" TEXT,
ADD COLUMN     "manual_payment_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "online_payment_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'CASHFREE',
    "gateway_order_id" TEXT NOT NULL,
    "gateway_payment_id" TEXT,
    "payment_session_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_payment_submissions" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payment_method" TEXT NOT NULL,
    "utr_number" TEXT NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "proof_file_url" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_payment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_gateway_order_id_key" ON "payment_attempts"("gateway_order_id");

-- CreateIndex
CREATE INDEX "payment_attempts_invoice_id_idx" ON "payment_attempts"("invoice_id");

-- CreateIndex
CREATE INDEX "payment_attempts_client_id_idx" ON "payment_attempts"("client_id");

-- CreateIndex
CREATE INDEX "manual_payment_submissions_invoice_id_idx" ON "manual_payment_submissions"("invoice_id");

-- CreateIndex
CREATE INDEX "manual_payment_submissions_client_id_idx" ON "manual_payment_submissions"("client_id");

-- CreateIndex
CREATE INDEX "manual_payment_submissions_status_idx" ON "manual_payment_submissions"("status");

-- CreateIndex
CREATE INDEX "manual_payment_submissions_utr_number_idx" ON "manual_payment_submissions"("utr_number");

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_payment_submissions" ADD CONSTRAINT "manual_payment_submissions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_payment_submissions" ADD CONSTRAINT "manual_payment_submissions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_payment_submissions" ADD CONSTRAINT "manual_payment_submissions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
