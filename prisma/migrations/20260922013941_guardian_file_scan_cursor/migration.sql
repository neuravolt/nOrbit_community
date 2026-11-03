-- CreateTable
CREATE TABLE "guardian_file_scan_cursors" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "file_inventory" JSONB NOT NULL DEFAULT '[]',
    "last_scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_file_scan_cursors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guardian_file_scan_cursors_asset_id_source_key" ON "guardian_file_scan_cursors"("asset_id", "source");

-- AddForeignKey
ALTER TABLE "guardian_file_scan_cursors" ADD CONSTRAINT "guardian_file_scan_cursors_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

