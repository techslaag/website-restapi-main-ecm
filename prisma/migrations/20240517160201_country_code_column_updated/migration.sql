/*
  Warnings:

  - You are about to drop the column `countryCode` on the `iplookupbackup` table. All the data in the column will be lost.
  - Added the required column `countryAlpha2Code` to the `IpLookupBackup` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `IpLookupBackup` DROP COLUMN `countryCode`,
    ADD COLUMN `countryAlpha2Code` VARCHAR(191) NOT NULL;
