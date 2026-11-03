BEGIN;
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_organizationId_fkey";
ALTER TABLE "Client" DROP CONSTRAINT IF EXISTS "Client_organizationId_fkey";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_organizationId_fkey";
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_organizationId_fkey";
ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_organizationId_fkey";
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_organizationId_fkey";
ALTER TABLE "Quote" DROP CONSTRAINT IF EXISTS "Quote_organizationId_fkey";
ALTER TABLE "AmcContract" DROP CONSTRAINT IF EXISTS "AmcContract_organizationId_fkey";
ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_organizationId_fkey";
ALTER TABLE "Attachment" DROP CONSTRAINT IF EXISTS "Attachment_organizationId_fkey";

ALTER TABLE "Project" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "Client" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "Quote" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "AmcContract" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "Asset" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "Attachment" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "User" DROP COLUMN IF EXISTS "userType";
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerified";
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerificationTokenHash";
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerificationExpiresAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "passwordResetTokenHash";
ALTER TABLE "User" DROP COLUMN IF EXISTS "passwordResetExpiresAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "activeOrganizationId";

DROP TABLE IF EXISTS "OrganizationInvitation" CASCADE;
DROP TABLE IF EXISTS "OrganizationMember" CASCADE;
DROP TYPE IF EXISTS "OrganizationRole";
DROP TYPE IF EXISTS "InvitationStatus";
COMMIT;
