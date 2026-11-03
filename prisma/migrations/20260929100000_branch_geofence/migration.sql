-- Office geofence per branch: attendance punches outside the radius are flagged for HR review
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "radiusMeters" INTEGER;
