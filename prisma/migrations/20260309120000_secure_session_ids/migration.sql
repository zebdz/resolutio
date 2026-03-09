-- Remove CUID default from session IDs (now generated in application code)
ALTER TABLE "sessions" ALTER COLUMN "id" DROP DEFAULT;

-- Store IP and user-agent per session for audit/forensics
ALTER TABLE "sessions" ADD COLUMN "ip_address" TEXT;
ALTER TABLE "sessions" ADD COLUMN "user_agent" TEXT;
