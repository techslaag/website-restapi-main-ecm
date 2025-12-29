-- CreateTable
CREATE TABLE `Plan` (
    `id` VARCHAR(191) NOT NULL,
    `planType` ENUM('PREMIUM', 'ECOMEMBER') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `physicalMagazineVersion` VARCHAR(191) NOT NULL,
    `monthlyPrice` DOUBLE NOT NULL,
    `yearlyPrice` DOUBLE NOT NULL,
    `amountCurrency` ENUM('XAF', 'XOF', 'USD', 'EUR') NOT NULL,
    `exclusivity` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `paidAmount` DOUBLE NOT NULL,
    `paidAmountCurrent` ENUM('XAF', 'XOF', 'USD', 'EUR') NOT NULL,
    `receivedAmount` DOUBLE NOT NULL,
    `receivedCurrency` ENUM('XAF', 'XOF', 'USD', 'EUR') NOT NULL,
    `paymentProviderId` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Payment_reference_key`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentProvider` (
    `id` VARCHAR(191) NOT NULL,
    `countryAlpha2` VARCHAR(191) NOT NULL,
    `countryAlpha3` VARCHAR(191) NOT NULL,
    `currency` ENUM('XAF', 'XOF', 'USD', 'EUR') NOT NULL,
    `paymentType` ENUM('CARD', 'MOBILE') NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NULL,
    `expiredAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostPurchase` (
    `id` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `mod180_postsID` BIGINT UNSIGNED NOT NULL,
    `paymentId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
