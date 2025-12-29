-- AlterTable
ALTER TABLE `Subscription` ADD COLUMN `period` ENUM('month', 'year') NOT NULL DEFAULT 'month';
