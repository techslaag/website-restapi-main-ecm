/*
  Warnings:

  - The values [package] on the enum `Purchase_entityType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `Purchase` MODIFY `entityType` ENUM('post', 'magazine', 'biweekly', 'special_issues', 'packagefw') NOT NULL;
