-- New employees: a one-time "set your password" link and a first-login password change
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "invite_token_hash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "invite_expires_at" TIMESTAMP(3);
