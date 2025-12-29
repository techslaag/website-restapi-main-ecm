/*
  Warnings:

  - You are about to drop the `userpreference` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `UserPreference`;

-- CreateTable
CREATE TABLE `UserProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `businessName` VARCHAR(191) NULL,
    `businessRole` VARCHAR(191) NULL,
    `businessService` VARCHAR(191) NULL,
    `businessSize` VARCHAR(191) NULL,
    `homeOffers` BOOLEAN NOT NULL,
    `partnerOffers` BOOLEAN NOT NULL,
    `noOffers` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NULL,

    UNIQUE INDEX `UserProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
