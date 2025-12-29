/*
  Warnings:

  - You are about to drop the column `categoryPId` on the `product` table. All the data in the column will be lost.
  - You are about to drop the `categoryp` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `mainClass` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Product` DROP COLUMN `categoryPId`,
    ADD COLUMN `additives` ENUM('FoodsColors', 'Preservatives', 'AntioxidantsAndAcidityRegulators', 'TextureAgents', 'EmulsifiersAndStabilizers', 'FlavorEnhancers', 'Miscellaneous') NULL,
    ADD COLUMN `mainClass` ENUM('DairyProducts', 'FatsAndOils', 'ConsumerIceCream', 'FruitsAndVegetables', 'Confectionery', 'CerealsAndCerealBasedProducts', 'BakeryProducts', 'MeatAndMeatProducts', 'FishAndFisheryProducts', 'EggsAndEggProducts', 'Sweeteners', 'SaltSpicesSoupsSauces', 'Salads', 'FoodsIntendedForSpecialDiets', 'Beverages') NOT NULL,
    ADD COLUMN `nutritionalClass` ENUM('Proteins', 'Carbohydrates', 'Fat', 'VitaminsAndMinerals') NULL,
    ADD COLUMN `originAndTreatment` ENUM('ProductsAnimal', 'ProductsPlant', 'ProcessedProducts', 'Beverages', 'GroceryProducts') NULL,
    ADD COLUMN `specialClass` ENUM('Organic', 'GlutenFree', 'VegetarianVegan', 'FunctionalFortified') NULL;

-- DropTable
DROP TABLE `CategoryP`;
