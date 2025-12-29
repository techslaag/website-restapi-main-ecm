-- AlterTable
ALTER TABLE `Commune` ADD COLUMN `averagePriceBuiltBuilding` DECIMAL(12, 2) NULL DEFAULT 0.00,
    ADD COLUMN `averagePriceUnbuiltBuilding` DECIMAL(12, 2) NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE `Department` ADD COLUMN `averagePriceBuiltBuilding` DECIMAL(12, 2) NULL DEFAULT 0.00,
    ADD COLUMN `averagePriceUnbuiltBuilding` DECIMAL(12, 2) NULL DEFAULT 0.00;
