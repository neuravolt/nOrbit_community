-- Joining/exit checklist ticks made by HR (items the system can prove are computed, not stored)
ALTER TABLE "EmployeeProfile" ADD COLUMN IF NOT EXISTS "checklistJson" TEXT;
