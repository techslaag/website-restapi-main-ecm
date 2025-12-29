/*
  Warnings:

  - You are about to drop the column `identifier` on the `paymentprovider` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[reference]` on the table `PaymentProvider` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `commonIdentifier` to the `PaymentProvider` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reference` to the `PaymentProvider` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `PaymentProvider_identifier_key` ON `PaymentProvider`;

-- AlterTable
ALTER TABLE `PaymentProvider` DROP COLUMN `identifier`,
    ADD COLUMN `commonIdentifier` VARCHAR(191) NOT NULL,
    ADD COLUMN `reference` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `PaymentProvider_reference_key` ON `PaymentProvider`(`reference`);
