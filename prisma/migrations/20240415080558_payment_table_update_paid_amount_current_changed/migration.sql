/*
  Warnings:

  - You are about to drop the column `paidAmountCurrent` on the `payment` table. All the data in the column will be lost.
  - Added the required column `paidAmountCurrency` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Payment` DROP COLUMN `paidAmountCurrent`,
    ADD COLUMN `paidAmountCurrency` ENUM('xaf', 'xof', 'usd', 'eur') NOT NULL;
