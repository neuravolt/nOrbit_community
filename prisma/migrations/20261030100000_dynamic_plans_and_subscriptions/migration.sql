-- CreateTable Plan
CREATE TABLE IF NOT EXISTS "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "priceMonthlyINR" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceYearlyINR" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceMonthlyUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceYearlyUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxMembers" INTEGER NOT NULL DEFAULT 5,
    "maxProjects" INTEGER NOT NULL DEFAULT 10,
    "maxServers" INTEGER NOT NULL DEFAULT 1,
    "featureProjectsTasks" BOOLEAN NOT NULL DEFAULT true,
    "featureCrm" BOOLEAN NOT NULL DEFAULT true,
    "featureBilling" BOOLEAN NOT NULL DEFAULT true,
    "featureGuardianByovps" BOOLEAN NOT NULL DEFAULT false,
    "featureClientPortal" BOOLEAN NOT NULL DEFAULT false,
    "featureApiAccess" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable OrganizationSubscription
CREATE TABLE IF NOT EXISTS "OrganizationSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "billingInterval" TEXT NOT NULL DEFAULT 'MONTHLY',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "customMaxMembers" INTEGER,
    "customMaxProjects" INTEGER,
    "customMaxServers" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "trialExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationSubscription_pkey" PRIMARY KEY ("id")
);

-- Unique constraints & indices for Plan
CREATE UNIQUE INDEX IF NOT EXISTS "Plan_name_key" ON "Plan"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Plan_slug_key" ON "Plan"("slug");

-- Unique constraints & indices for OrganizationSubscription
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationSubscription_organizationId_key" ON "OrganizationSubscription"("organizationId");
CREATE INDEX IF NOT EXISTS "OrganizationSubscription_organizationId_idx" ON "OrganizationSubscription"("organizationId");
CREATE INDEX IF NOT EXISTS "OrganizationSubscription_planId_idx" ON "OrganizationSubscription"("planId");
CREATE INDEX IF NOT EXISTS "OrganizationSubscription_status_idx" ON "OrganizationSubscription"("status");

-- Foreign key constraints
DO $$ BEGIN
    ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed default plans (Starter, Pro, Enterprise, Custom)
INSERT INTO "Plan" (
    "id", "name", "slug", "description",
    "priceMonthlyINR", "priceYearlyINR", "priceMonthlyUSD", "priceYearlyUSD",
    "maxMembers", "maxProjects", "maxServers",
    "featureProjectsTasks", "featureCrm", "featureBilling", "featureGuardianByovps", "featureClientPortal", "featureApiAccess",
    "isPublic", "isActive", "sortOrder", "createdAt", "updatedAt"
) VALUES
(
    'plan-starter-default',
    'Starter',
    'starter',
    'Ideal for small teams and fast-growing startups getting started with nORBIT.',
    999,
    9990,
    15,
    150,
    5,
    10,
    1,
    true,
    true,
    true,
    true,
    false,
    false,
    true,
    true,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'plan-pro-default',
    'Pro',
    'pro',
    'Full-featured collaboration, client portal, and enhanced infrastructure monitoring.',
    2999,
    29990,
    39,
    390,
    15,
    50,
    5,
    true,
    true,
    true,
    true,
    true,
    false,
    true,
    true,
    2,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'plan-enterprise-default',
    'Enterprise',
    'enterprise',
    'Unlimited scale, dedicated infrastructure, API access, and prioritized 24/7 SLA.',
    9999,
    99990,
    129,
    1290,
    -1,
    -1,
    25,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    3,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'plan-custom-default',
    'Custom',
    'custom',
    'Bespoke enterprise contract with tailored resource quotas and custom billing.',
    0,
    0,
    0,
    0,
    10,
    20,
    2,
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    true,
    4,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "priceMonthlyINR" = EXCLUDED."priceMonthlyINR",
    "priceYearlyINR" = EXCLUDED."priceYearlyINR",
    "priceMonthlyUSD" = EXCLUDED."priceMonthlyUSD",
    "priceYearlyUSD" = EXCLUDED."priceYearlyUSD",
    "maxMembers" = EXCLUDED."maxMembers",
    "maxProjects" = EXCLUDED."maxProjects",
    "maxServers" = EXCLUDED."maxServers",
    "featureProjectsTasks" = EXCLUDED."featureProjectsTasks",
    "featureCrm" = EXCLUDED."featureCrm",
    "featureBilling" = EXCLUDED."featureBilling",
    "featureGuardianByovps" = EXCLUDED."featureGuardianByovps",
    "featureClientPortal" = EXCLUDED."featureClientPortal",
    "featureApiAccess" = EXCLUDED."featureApiAccess",
    "isPublic" = EXCLUDED."isPublic",
    "isActive" = EXCLUDED."isActive",
    "sortOrder" = EXCLUDED."sortOrder",
    "updatedAt" = CURRENT_TIMESTAMP;

-- Backfill default Starter subscription for existing organizations lacking a subscription
INSERT INTO "OrganizationSubscription" (
    "id",
    "organizationId",
    "planId",
    "status",
    "billingInterval",
    "currency",
    "createdAt",
    "updatedAt"
)
SELECT
    'sub-' || substr(md5(random()::text || clock_timestamp()::text), 1, 28),
    o."id",
    p."id",
    'ACTIVE',
    'MONTHLY',
    'INR',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Organization" o
CROSS JOIN (SELECT "id" FROM "Plan" WHERE "slug" = 'starter' LIMIT 1) p
WHERE NOT EXISTS (
    SELECT 1 FROM "OrganizationSubscription" s WHERE s."organizationId" = o."id"
);
