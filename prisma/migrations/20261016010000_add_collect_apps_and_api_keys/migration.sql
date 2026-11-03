-- CreateEnum
CREATE TYPE "CollectKeyEnvironment" AS ENUM ('TEST', 'LIVE');

-- CreateEnum
CREATE TYPE "CollectKeyStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "collect_apps" (
    "id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "webhook_url" TEXT,
    "webhook_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collect_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collect_api_keys" (
    "id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "name" TEXT,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "environment" "CollectKeyEnvironment" NOT NULL DEFAULT 'LIVE',
    "status" "CollectKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collect_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collect_apps_app_id_key" ON "collect_apps"("app_id");

-- CreateIndex
CREATE UNIQUE INDEX "collect_api_keys_key_hash_key" ON "collect_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "collect_api_keys_app_id_status_idx" ON "collect_api_keys"("app_id", "status");

-- CreateIndex
CREATE INDEX "collect_api_keys_key_prefix_idx" ON "collect_api_keys"("key_prefix");

-- AddForeignKey
ALTER TABLE "collect_api_keys" ADD CONSTRAINT "collect_api_keys_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "collect_apps"("app_id") ON DELETE CASCADE ON UPDATE CASCADE;
