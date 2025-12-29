/*
  Warnings:

  - A unique constraint covering the columns `[reference]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdAt` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reference` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `createdAt` DATETIME(3) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `Subscription` ADD COLUMN `reference` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Subscription_reference_key` ON `Subscription`(`reference`);
