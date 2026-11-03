-- DropIndex
DROP INDEX "PayrollRunSnapshot_payrollRunId_key";

-- CreateIndex
CREATE INDEX "PayrollRunSnapshot_payrollRunId_capturedAt_idx" ON "PayrollRunSnapshot"("payrollRunId", "capturedAt");

