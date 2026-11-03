-- CreateEnum
CREATE TYPE "GuardianPlan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "guardian_plan" "GuardianPlan" NOT NULL DEFAULT 'ENTERPRISE';

