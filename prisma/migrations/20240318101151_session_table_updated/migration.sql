/*
  Warnings:

  - Added the required column `userAgent` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userIpAddress` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Session` ADD COLUMN `userAgent` VARCHAR(191) NOT NULL,
    ADD COLUMN `userIpAddress` VARCHAR(191) NOT NULL;
