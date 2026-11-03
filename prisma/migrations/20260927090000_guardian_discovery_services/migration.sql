-- Dynamic service discovery: services found on a server (MQTT, databases, containers, ...)
ALTER TABLE "guardian_discoveries" ADD COLUMN "services" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "guardian_discoveries" ADD COLUMN "services_note" TEXT;
