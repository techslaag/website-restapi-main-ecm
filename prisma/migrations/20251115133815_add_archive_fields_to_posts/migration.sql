-- Migration to add archive functionality to posts
-- This adds archived and archivedAt fields to the mod180_posts table

-- Add archived fields
ALTER TABLE `mod180_posts` 
ADD COLUMN `archived` BOOLEAN DEFAULT FALSE,
ADD COLUMN `archivedAt` DATETIME(3) NULL;

-- Add index for efficient queries on archived posts
CREATE INDEX `idx_archived_date` ON `mod180_posts`(`archived`, `post_date_gmt`);

-- Update existing posts to ensure they are not archived by default
UPDATE `mod180_posts` SET `archived` = FALSE WHERE `archived` IS NULL;