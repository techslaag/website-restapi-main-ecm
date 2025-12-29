/*
  Warnings:

  - Made the column `nutritionalClass` on table `product` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `entryDate` to the `ProductInCity` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Product` MODIFY `nutritionalClass` ENUM('Proteins', 'Carbohydrates', 'Fat', 'VitaminsAndMinerals') NOT NULL;

-- AlterTable
ALTER TABLE `ProductInCity` ADD COLUMN `entryDate` DATETIME(3) NOT NULL;
