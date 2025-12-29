-- CreateTable
CREATE TABLE `CurrencyExchangeRates` (
    `id` VARCHAR(191) NOT NULL,
    `provider` ENUM('exchangeRateApi') NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
