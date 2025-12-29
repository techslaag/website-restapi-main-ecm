/*
  Warnings:

  - You are about to alter the column `physicalMagazineVersion` on the `plan` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `TinyInt`.

*/
-- AlterTable
ALTER TABLE `Plan` MODIFY `physicalMagazineVersion` BOOLEAN NOT NULL;
