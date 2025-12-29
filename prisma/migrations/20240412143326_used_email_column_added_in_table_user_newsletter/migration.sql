/*
  Warnings:

  - Added the required column `usedEmail` to the `UserNewsletter` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `UserNewsletter` ADD COLUMN `usedEmail` VARCHAR(191) NOT NULL;
