/*
  Warnings:

  - Made the column `currencyCode` on table `country` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `Country` MODIFY `currencyCode` CHAR(3) NOT NULL;
