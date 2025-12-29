/*
  Warnings:

  - Added the required column `provider` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `provider` ENUM('stripe', 'flutterwave') NOT NULL,
    MODIFY `paymentProviderId` VARCHAR(191) NULL;
