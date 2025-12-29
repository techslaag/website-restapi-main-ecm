/*
  Warnings:

  - You are about to drop the `productcityonprice` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `ProductCityOnPrice`;

-- CreateTable
CREATE TABLE `ProductInCity` (
    `cityId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `currency` ENUM('xaf', 'xof', 'usd', 'eur', 'gbp') NOT NULL,
    `avalaibility` ENUM('Avalaible', 'Unavalaible') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,
    `productCityOnPriceCityId` VARCHAR(191) NULL,
    `productCityOnPriceProductId` VARCHAR(191) NULL,

    UNIQUE INDEX `ProductInCity_productCityOnPriceCityId_productCityOnPricePro_key`(`productCityOnPriceCityId`, `productCityOnPriceProductId`),
    PRIMARY KEY (`cityId`, `productId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
