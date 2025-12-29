/*
  Warnings:

  - A unique constraint covering the columns `[identifier]` on the table `PaymentProvider` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `identifier` to the `PaymentProvider` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `PaymentProvider` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `errors` JSON NULL,
    ADD COLUMN `webhookPayloads` JSON NULL;

-- AlterTable
ALTER TABLE `PaymentProvider` ADD COLUMN `identifier` VARCHAR(191) NOT NULL,
    ADD COLUMN `logoUrl` VARCHAR(191) NULL,
    ADD COLUMN `name` VARCHAR(191) NOT NULL,
    MODIFY `paymentType` ENUM('CARD', 'MOBILE', 'DIGITAL_WALLET') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `PaymentProvider_identifier_key` ON `PaymentProvider`(`identifier`);
