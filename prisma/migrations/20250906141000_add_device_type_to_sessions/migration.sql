-- Add deviceType column to Session table
ALTER TABLE `Session` ADD COLUMN `deviceType` ENUM('phone', 'tablet', 'desktop', 'tv') NOT NULL DEFAULT 'desktop';

-- Create composite index for userId and deviceType
CREATE INDEX `userIdDeviceType` ON `Session`(`userId`, `deviceType`);