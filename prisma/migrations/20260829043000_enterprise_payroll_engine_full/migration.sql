-- CreateEnum
CREATE TYPE "PayrollAuditEntityType" AS ENUM ('SALARY_COMPONENT', 'EMPLOYEE_SALARY_COMPONENT', 'HOLIDAY_CALENDAR', 'HOLIDAY', 'HOLIDAY_ASSIGNMENT', 'WORKING_WEEK', 'TAX_REGIME_CONFIG', 'PAYROLL_ADJUSTMENT', 'EMPLOYEE_OVERRIDE');

-- CreateEnum
CREATE TYPE "PayrollAuditAction" AS ENUM ('CREATE', 'UPDATE', 'DEACTIVATE', 'DELETE', 'ASSIGN', 'APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "SalaryComponentType" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "SalaryComponentCalcType" AS ENUM ('FIXED', 'PERCENTAGE_OF_BASIC', 'PERCENTAGE_OF_GROSS', 'PERCENTAGE_OF_CTC', 'PER_DAY', 'PER_HOUR', 'TARGET_BASED', 'RATING_BASED', 'MANUAL', 'FORMULA');

-- CreateEnum
CREATE TYPE "SalaryComponentFrequency" AS ENUM ('MONTHLY', 'ANNUAL', 'ONE_TIME', 'VARIABLE');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentType" AS ENUM ('ARREAR_SALARY', 'ARREAR_INCREMENT', 'ARREAR_PROMOTION', 'CORRECTION', 'MANUAL_EARNING', 'MANUAL_DEDUCTION', 'BONUS');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateEnum
CREATE TYPE "HolidayKind" AS ENUM ('PUBLIC', 'OPTIONAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "DayType" AS ENUM ('FULL_DAY', 'HALF_DAY', 'OFF', 'ALTERNATE');

-- CreateEnum
CREATE TYPE "OvertimeEntryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PayrollRunStatus" ADD VALUE 'CALCULATED';
ALTER TYPE "PayrollRunStatus" ADD VALUE 'REVIEW';
ALTER TYPE "PayrollRunStatus" ADD VALUE 'FINALIZED';
ALTER TYPE "PayrollRunStatus" ADD VALUE 'LOCKED';

-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "calculatedAt" TIMESTAMP(3),
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "finalizedBy" TEXT,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedBy" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN     "arrearsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "calculationVersion" TEXT,
ADD COLUMN     "componentBreakdownJson" JSONB,
ADD COLUMN     "employerCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "overtimePay" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "snapshotId" TEXT;

-- CreateTable
CREATE TABLE "PayrollConfigVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "pfEmployeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.12,
    "pfEmployerRate" DOUBLE PRECISION NOT NULL DEFAULT 0.12,
    "pfWageCeiling" DOUBLE PRECISION NOT NULL DEFAULT 15000,
    "pfApplyWageCap" BOOLEAN NOT NULL DEFAULT true,
    "pfEnabled" BOOLEAN NOT NULL DEFAULT true,
    "highPackageBasicThreshold" DOUBLE PRECISION NOT NULL DEFAULT 999999,
    "highPackagePfOptional" BOOLEAN NOT NULL DEFAULT false,
    "esiEmployeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0075,
    "esiEmployerRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0325,
    "esiGrossCeiling" DOUBLE PRECISION NOT NULL DEFAULT 21000,
    "esiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ptState" TEXT NOT NULL DEFAULT 'Karnataka',
    "ptSlabsJson" TEXT NOT NULL DEFAULT '[{"upTo":14999,"amount":0},{"upTo":19999,"amount":150},{"upTo":9999999,"amount":200}]',
    "ptEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lwpCalculationBase" TEXT NOT NULL DEFAULT 'CALENDAR',
    "defaultConveyanceEmployee" DOUBLE PRECISION NOT NULL DEFAULT 1600,
    "defaultConveyanceIntern" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultConveyanceContract" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultTaxRegime" TEXT NOT NULL DEFAULT 'NEW',
    "employmentTypeDefaultsJson" TEXT NOT NULL DEFAULT '{"EMPLOYEE":{"pfApplicable":true,"esiApplicable":true},"PAID_INTERN":{"pfApplicable":false,"esiApplicable":false,"ptOverride":0},"CONTRACT":{"pfApplicable":false,"esiApplicable":false,"tdsRate":0.10},"UNPAID_INTERN":{"pfApplicable":false,"esiApplicable":false,"ptOverride":0,"skipPayroll":true}}',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeReason" TEXT NOT NULL,

    CONSTRAINT "PayrollConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollConfigAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "configVersionId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollConfigAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" "PayrollAuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "PayrollAuditAction" NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryComponent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SalaryComponentType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "calcType" "SalaryComponentCalcType" NOT NULL DEFAULT 'FIXED',
    "calcBase" TEXT,
    "fixedAmount" DOUBLE PRECISION,
    "percentage" DOUBLE PRECISION,
    "formula" TEXT,
    "frequency" "SalaryComponentFrequency" NOT NULL DEFAULT 'MONTHLY',
    "pfApplicable" BOOLEAN NOT NULL DEFAULT false,
    "esiApplicable" BOOLEAN NOT NULL DEFAULT false,
    "ptApplicable" BOOLEAN NOT NULL DEFAULT false,
    "tdsApplicable" BOOLEAN NOT NULL DEFAULT true,
    "proratable" BOOLEAN NOT NULL DEFAULT true,
    "lwpAffected" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSalaryComponent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "amountOverride" DOUBLE PRECISION,
    "percentageOverride" DOUBLE PRECISION,
    "isEligible" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeSalaryComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PayrollAdjustmentType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "targetMonth" INTEGER NOT NULL,
    "targetYear" INTEGER NOT NULL,
    "status" "PayrollAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "appliedInRunId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayCalendar" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "state" TEXT,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HolidayCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HolidayKind" NOT NULL DEFAULT 'PUBLIC',
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayCalendarAssignment" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "HolidayCalendarAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingWeek" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "monday" "DayType" NOT NULL DEFAULT 'FULL_DAY',
    "tuesday" "DayType" NOT NULL DEFAULT 'FULL_DAY',
    "wednesday" "DayType" NOT NULL DEFAULT 'FULL_DAY',
    "thursday" "DayType" NOT NULL DEFAULT 'FULL_DAY',
    "friday" "DayType" NOT NULL DEFAULT 'FULL_DAY',
    "saturday" "DayType" NOT NULL DEFAULT 'OFF',
    "sunday" "DayType" NOT NULL DEFAULT 'OFF',
    "alternateSaturdayRule" TEXT NOT NULL DEFAULT 'NONE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkingWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRegimeConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "regimeType" TEXT NOT NULL,
    "standardDeduction" DOUBLE PRECISION NOT NULL DEFAULT 75000,
    "rebateLimit" DOUBLE PRECISION NOT NULL DEFAULT 700000,
    "rebateAmount" DOUBLE PRECISION NOT NULL DEFAULT 25000,
    "cessRate" DOUBLE PRECISION NOT NULL DEFAULT 0.04,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRegimeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxSlab" (
    "id" TEXT NOT NULL,
    "regimeConfigId" TEXT NOT NULL,
    "incomeFrom" DOUBLE PRECISION NOT NULL,
    "incomeTo" DOUBLE PRECISION,
    "taxRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TaxSlab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxSurchargeSlab" (
    "id" TEXT NOT NULL,
    "regimeConfigId" TEXT NOT NULL,
    "incomeFrom" DOUBLE PRECISION NOT NULL,
    "incomeTo" DOUBLE PRECISION,
    "surchargeRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TaxSurchargeSlab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxExemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "declaredAmount" DOUBLE PRECISION NOT NULL,
    "approvedAmount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'DECLARED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxExemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "normalMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "weekendMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "holidayMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OvertimeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "dayKind" TEXT NOT NULL,
    "status" "OvertimeEntryStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OvertimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRunSnapshot" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "pfEmployeeRate" DOUBLE PRECISION NOT NULL,
    "pfEmployerRate" DOUBLE PRECISION NOT NULL,
    "pfWageCeiling" DOUBLE PRECISION NOT NULL,
    "esiEmployeeRate" DOUBLE PRECISION NOT NULL,
    "esiEmployerRate" DOUBLE PRECISION NOT NULL,
    "esiGrossCeiling" DOUBLE PRECISION NOT NULL,
    "ptState" TEXT NOT NULL,
    "lwpCalculationBase" TEXT NOT NULL,
    "taxRegime" TEXT NOT NULL,
    "payrollConfigJson" JSONB NOT NULL,
    "salaryComponentsJson" JSONB NOT NULL,
    "employeeSalarySnapshotJson" JSONB NOT NULL,
    "taxConfigJson" JSONB,
    "holidayCalendarJson" JSONB,
    "workingWeekJson" JSONB,
    "overtimeConfigJson" JSONB,
    "adjustmentsJson" JSONB,
    "calculationVersion" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedBy" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PayrollRunSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollConfigVersion_organizationId_isActive_idx" ON "PayrollConfigVersion"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "PayrollConfigVersion_organizationId_effectiveFrom_effective_idx" ON "PayrollConfigVersion"("organizationId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollConfigVersion_organizationId_version_key" ON "PayrollConfigVersion"("organizationId", "version");

-- CreateIndex
CREATE INDEX "PayrollConfigAuditLog_organizationId_changedAt_idx" ON "PayrollConfigAuditLog"("organizationId", "changedAt");

-- CreateIndex
CREATE INDEX "PayrollConfigAuditLog_configVersionId_idx" ON "PayrollConfigAuditLog"("configVersionId");

-- CreateIndex
CREATE INDEX "PayrollAuditLog_organizationId_entityType_entityId_idx" ON "PayrollAuditLog"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "PayrollAuditLog_organizationId_createdAt_idx" ON "PayrollAuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "SalaryComponent_organizationId_isActive_idx" ON "SalaryComponent"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "SalaryComponent_organizationId_type_idx" ON "SalaryComponent"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryComponent_organizationId_code_key" ON "SalaryComponent"("organizationId", "code");

-- CreateIndex
CREATE INDEX "EmployeeSalaryComponent_userId_isEligible_idx" ON "EmployeeSalaryComponent"("userId", "isEligible");

-- CreateIndex
CREATE INDEX "EmployeeSalaryComponent_componentId_idx" ON "EmployeeSalaryComponent"("componentId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_userId_status_idx" ON "PayrollAdjustment"("userId", "status");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_organizationId_targetYear_targetMonth_idx" ON "PayrollAdjustment"("organizationId", "targetYear", "targetMonth");

-- CreateIndex
CREATE INDEX "HolidayCalendar_organizationId_year_isActive_idx" ON "HolidayCalendar"("organizationId", "year", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "HolidayCalendar_organizationId_name_year_key" ON "HolidayCalendar"("organizationId", "name", "year");

-- CreateIndex
CREATE INDEX "Holiday_calendarId_date_idx" ON "Holiday"("calendarId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_calendarId_date_key" ON "Holiday"("calendarId", "date");

-- CreateIndex
CREATE INDEX "HolidayCalendarAssignment_userId_idx" ON "HolidayCalendarAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HolidayCalendarAssignment_calendarId_userId_key" ON "HolidayCalendarAssignment"("calendarId", "userId");

-- CreateIndex
CREATE INDEX "WorkingWeek_organizationId_isActive_idx" ON "WorkingWeek"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "TaxRegimeConfig_organizationId_financialYear_idx" ON "TaxRegimeConfig"("organizationId", "financialYear");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRegimeConfig_organizationId_financialYear_regimeType_key" ON "TaxRegimeConfig"("organizationId", "financialYear", "regimeType");

-- CreateIndex
CREATE INDEX "TaxSlab_regimeConfigId_idx" ON "TaxSlab"("regimeConfigId");

-- CreateIndex
CREATE INDEX "TaxSurchargeSlab_regimeConfigId_idx" ON "TaxSurchargeSlab"("regimeConfigId");

-- CreateIndex
CREATE INDEX "TaxExemption_userId_financialYear_idx" ON "TaxExemption"("userId", "financialYear");

-- CreateIndex
CREATE INDEX "OvertimeConfig_organizationId_isActive_idx" ON "OvertimeConfig"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "OvertimeEntry_userId_date_idx" ON "OvertimeEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRunSnapshot_payrollRunId_key" ON "PayrollRunSnapshot"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollRunSnapshot_payrollRunId_idx" ON "PayrollRunSnapshot"("payrollRunId");

-- AddForeignKey
ALTER TABLE "PayrollConfigVersion" ADD CONSTRAINT "PayrollConfigVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollConfigAuditLog" ADD CONSTRAINT "PayrollConfigAuditLog_configVersionId_fkey" FOREIGN KEY ("configVersionId") REFERENCES "PayrollConfigVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAuditLog" ADD CONSTRAINT "PayrollAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryComponent" ADD CONSTRAINT "EmployeeSalaryComponent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryComponent" ADD CONSTRAINT "EmployeeSalaryComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SalaryComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_appliedInRunId_fkey" FOREIGN KEY ("appliedInRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayCalendar" ADD CONSTRAINT "HolidayCalendar_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "HolidayCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayCalendarAssignment" ADD CONSTRAINT "HolidayCalendarAssignment_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "HolidayCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayCalendarAssignment" ADD CONSTRAINT "HolidayCalendarAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkingWeek" ADD CONSTRAINT "WorkingWeek_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRegimeConfig" ADD CONSTRAINT "TaxRegimeConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxSlab" ADD CONSTRAINT "TaxSlab_regimeConfigId_fkey" FOREIGN KEY ("regimeConfigId") REFERENCES "TaxRegimeConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxSurchargeSlab" ADD CONSTRAINT "TaxSurchargeSlab_regimeConfigId_fkey" FOREIGN KEY ("regimeConfigId") REFERENCES "TaxRegimeConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxExemption" ADD CONSTRAINT "TaxExemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeConfig" ADD CONSTRAINT "OvertimeConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeEntry" ADD CONSTRAINT "OvertimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunSnapshot" ADD CONSTRAINT "PayrollRunSnapshot_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

