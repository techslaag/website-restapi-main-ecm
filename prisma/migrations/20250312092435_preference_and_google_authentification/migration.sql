/*
  Warnings:

  - You are about to drop the column `PaymentType` on the `PaymentProvider` table. All the data in the column will be lost.
  - Added the required column `paymentType` to the `PaymentProvider` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `PaymentProvider` DROP COLUMN `PaymentType`,
    ADD COLUMN `paymentType` ENUM('card', 'mobile', 'digital_wallet') NOT NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `provider` VARCHAR(191) NULL DEFAULT 'email';

-- CreateTable
CREATE TABLE `Preference` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `categories` JSON NOT NULL,
    `fcmToken` VARCHAR(191) NULL,

    UNIQUE INDEX `Preference_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
