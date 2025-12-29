/*
  Warnings:

  - The `population` column on the `department` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `area` column on the `region` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `countryId` to the `Region` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Department` DROP COLUMN `population`,
    ADD COLUMN `population` INTEGER NULL;

-- AlterTable
ALTER TABLE `Region` ADD COLUMN `countryId` VARCHAR(191) NOT NULL,
    DROP COLUMN `area`,
    ADD COLUMN `area` DOUBLE NULL;
