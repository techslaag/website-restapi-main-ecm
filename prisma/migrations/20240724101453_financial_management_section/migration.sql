-- AlterTable
ALTER TABLE `Payment` MODIFY `receivedCurrency` ENUM('xaf', 'xof', 'usd', 'eur', 'gbp') NOT NULL,
    MODIFY `paidAmountCurrency` ENUM('xaf', 'xof', 'usd', 'eur', 'gbp') NOT NULL;

-- AlterTable
ALTER TABLE `PaymentProvider` MODIFY `currency` ENUM('xaf', 'xof', 'usd', 'eur', 'gbp') NOT NULL;

-- AlterTable
ALTER TABLE `Plan` MODIFY `amountCurrency` ENUM('xaf', 'xof', 'usd', 'eur', 'gbp') NOT NULL;

-- CreateTable
CREATE TABLE `Country` (
    `id` VARCHAR(191) NOT NULL,
    `countryName` VARCHAR(191) NOT NULL,
    `isoCode2` CHAR(2) NOT NULL,
    `isoCode3` CHAR(3) NOT NULL,
    `numericCode` INTEGER NOT NULL,
    `capital` VARCHAR(191) NULL,
    `population` INTEGER NULL,
    `area` DOUBLE NULL,
    `currencyCode` CHAR(3) NULL,
    `officialLanguage` VARCHAR(100) NULL,
    `continent` ENUM('Asia', 'Africa', 'NordAmerica', 'SouthAmerica', 'Antarctica', 'Europe', 'Oceania') NOT NULL,
    `timeZone` VARCHAR(191) NULL,
    `callingCode` VARCHAR(10) NULL,
    `internetTLD` VARCHAR(10) NULL,
    `gdp` DOUBLE NULL,
    `hdi` DOUBLE NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Region` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `area` JSON NOT NULL,
    `population` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Department` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `area` DOUBLE NULL,
    `population` JSON NULL,
    `regionId` VARCHAR(191) NOT NULL,
    `regionCapitalId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Department_regionCapitalId_key`(`regionCapitalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Commune` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `area` DOUBLE NULL,
    `population` INTEGER NULL,
    `type` ENUM('districtMunicipality', 'ruralCommune') NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `departmentCapitalId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Commune_departmentCapitalId_key`(`departmentCapitalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Neighborhood` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `averagePriceBuiltBuilding` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `averagePriceUnbuiltBuilding` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `area` DOUBLE NULL,
    `population` INTEGER NULL,
    `communeId` VARCHAR(191) NOT NULL,
    `successorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Neighborhood_successorId_key`(`successorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CategoryP` (
    `id` VARCHAR(191) NOT NULL,
    `mainClass` ENUM('DairyProducts', 'FatsAndOils', 'ConsumerIceCream', 'FruitsAndVegetables', 'Confectionery', 'CerealsAndCerealBasedProducts', 'BakeryProducts', 'MeatAndMeatProducts', 'FishAndFisheryProducts', 'EggsAndEggProducts', 'Sweeteners', 'SaltSpicesSoupsSauces', 'salads', 'FoodsIntendedForSpecialDiets', 'Beverages') NOT NULL,
    `additives` ENUM('FoodsColors', 'Preservatives', 'AntioxidantsAndAcidityRegulators', 'TextureAgents', 'EmulsifiersAndStabilizers', 'FlavorEnhancers', 'Miscellaneous') NULL,
    `originAndTreatment` ENUM('ProductsAnimal', 'ProductsPlant', 'ProcessedProducts', 'Beverages', 'GroceryProducts') NULL,
    `nutritionalClass` ENUM('Proteins', 'Carbohydrates', 'Fat', 'VitaminsAndMinerals') NULL,
    `specialClass` ENUM('Organic', 'GlutenFree', 'VegetarianVegan', 'FunctionalFortified') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Measurement` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `notation` VARCHAR(191) NOT NULL,
    `type` ENUM('Energy', 'Product') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `unitOfMeasurementId` VARCHAR(191) NOT NULL,
    `categoryPId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductCityOnPrice` (
    `cityId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `currency` ENUM('xaf', 'xof', 'usd', 'eur', 'gbp') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,
    `productCityOnPriceCityId` VARCHAR(191) NULL,
    `productCityOnPriceProductId` VARCHAR(191) NULL,

    UNIQUE INDEX `ProductCityOnPrice_productCityOnPriceCityId_productCityOnPri_key`(`productCityOnPriceCityId`, `productCityOnPriceProductId`),
    PRIMARY KEY (`cityId`, `productId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Energy` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `currency` ENUM('xaf', 'xof', 'usd', 'eur', 'gbp') NOT NULL,
    `measurementId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,
    `energyId` VARCHAR(191) NULL,
    `countryId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Energy_energyId_key`(`energyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
