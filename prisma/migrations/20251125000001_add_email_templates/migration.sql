-- Add new email template types
ALTER TYPE "EmailTemplate" ADD VALUE 'expired_subscription';
ALTER TYPE "EmailTemplate" ADD VALUE 'custom_message';
ALTER TYPE "EmailTemplate" ADD VALUE 'admin_notification';