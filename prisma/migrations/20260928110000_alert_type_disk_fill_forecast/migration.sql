-- A disk is on course to be full within the server's forecast window
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'DISK_FILL_FORECAST';
