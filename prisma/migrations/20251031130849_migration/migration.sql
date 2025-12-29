/*
  Warnings:

  - You are about to drop the column `order` on the `mod180_posts` table. All the data in the column will be lost.
  - You are about to drop the `mod180_snippets` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `TrialHistory` DROP FOREIGN KEY `TrialHistory_planId_fkey`;

-- DropForeignKey
ALTER TABLE `TrialHistory` DROP FOREIGN KEY `TrialHistory_subscriptionId_fkey`;

-- DropForeignKey
ALTER TABLE `TrialHistory` DROP FOREIGN KEY `TrialHistory_userId_fkey`;

-- DropIndex
DROP INDEX `TrialHistory_planId_fkey` ON `TrialHistory`;

-- AlterTable
ALTER TABLE `Plan` ADD COLUMN `isTrialEligible` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `trialDurationDays` INTEGER NULL,
    ADD COLUMN `trialFeatures` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `Subscription` ADD COLUMN `autoRenew` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `isTrial` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `trialConvertedAt` DATETIME(3) NULL,
    ADD COLUMN `trialEnd` DATETIME(3) NULL,
    ADD COLUMN `trialPrice` DECIMAL(12, 2) NULL,
    ADD COLUMN `trialStarted` DATETIME(3) NULL,
    MODIFY `period` ENUM('week', 'month', 'year') NOT NULL DEFAULT 'month';

-- AlterTable
ALTER TABLE `TrialHistory` MODIFY `userAgent` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `hasUsedTrial` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `trialStartedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `mod180_posts` DROP COLUMN `order`;

-- DropTable
DROP TABLE `mod180_snippets`;

-- CreateTable
CREATE TABLE `ad_insights` (
    `id` MEDIUMINT NOT NULL AUTO_INCREMENT,
    `ad_id` BIGINT UNSIGNED NOT NULL,
    `event_type` VARCHAR(20) NOT NULL,
    `user_ip` VARCHAR(45) NULL DEFAULT '',
    `user_agent` TEXT NULL DEFAULT '',
    `referer_url` TEXT NULL DEFAULT '',
    `timestamp` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `user_id` BIGINT UNSIGNED NULL DEFAULT 0,
    `session_id` VARCHAR(255) NULL DEFAULT '',
    `device_type` VARCHAR(255) NOT NULL DEFAULT '',
    `visitor_id` VARCHAR(255) NOT NULL DEFAULT '',

    INDEX `ad_id`(`ad_id`),
    INDEX `event_type`(`event_type`),
    INDEX `timestamp`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Interest` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `categoryId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Interest_slug_key`(`slug`),
    INDEX `Interest_slug_idx`(`slug`),
    INDEX `Interest_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserInterest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `interestId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserInterest_userId_idx`(`userId`),
    INDEX `UserInterest_interestId_idx`(`interestId`),
    UNIQUE INDEX `UserInterest_userId_interestId_key`(`userId`, `interestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
