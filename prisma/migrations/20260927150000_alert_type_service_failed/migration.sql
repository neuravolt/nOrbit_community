-- A systemd service on a monitored server entered the "failed" state
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'SERVICE_FAILED';
