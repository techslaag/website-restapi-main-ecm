/*
  Warnings:

  - The values [salads] on the enum `CategoryP_mainClass` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `CategoryP` MODIFY `mainClass` ENUM('DairyProducts', 'FatsAndOils', 'ConsumerIceCream', 'FruitsAndVegetables', 'Confectionery', 'CerealsAndCerealBasedProducts', 'BakeryProducts', 'MeatAndMeatProducts', 'FishAndFisheryProducts', 'EggsAndEggProducts', 'Sweeteners', 'SaltSpicesSoupsSauces', 'Salads', 'FoodsIntendedForSpecialDiets', 'Beverages') NOT NULL;

-- AlterTable
ALTER TABLE `Commune` MODIFY `departmentCapitalId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Department` MODIFY `regionCapitalId` VARCHAR(191) NULL;
