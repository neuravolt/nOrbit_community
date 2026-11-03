-- AlterTable
ALTER TABLE "guardian_wordpress_scans" ADD COLUMN     "uploads_file_inventory" JSONB NOT NULL DEFAULT '[]';

