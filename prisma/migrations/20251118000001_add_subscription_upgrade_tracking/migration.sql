-- Add upgrade tracking fields to Subscription table
ALTER TABLE `Subscription` ADD COLUMN `upgradedAt` DATETIME(3) NULL;
ALTER TABLE `Subscription` ADD COLUMN `upgradedFromPlanId` VARCHAR(191) NULL;
ALTER TABLE `Subscription` ADD COLUMN `upgradePrice` DECIMAL(12,2) NULL DEFAULT 0.00;
ALTER TABLE `Subscription` ADD COLUMN `upgradeCreditUsed` DECIMAL(12,2) NULL DEFAULT 0.00;
ALTER TABLE `Subscription` ADD COLUMN `upgradeDescription` TEXT NULL;