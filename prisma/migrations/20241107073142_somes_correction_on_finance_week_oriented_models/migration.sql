/*
  Warnings:

  - The primary key for the `financialweekuser` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `package` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE `FinancialWeekUser` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `Package` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- CreateTable
CREATE TABLE `PaymentPackage` (
    `id` VARCHAR(191) NOT NULL,
    `clientCountryAlpha2Code` VARCHAR(191) NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `status` ENUM('succeeded', 'failed', 'processing') NOT NULL,
    `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `paidAmountCurrency` ENUM('xaf', 'xof', 'usd', 'eur', 'gbp') NOT NULL,
    `receivedAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `receivedCurrency` ENUM('xaf', 'xof', 'usd', 'eur', 'gbp') NOT NULL,
    `provider` ENUM('stripe', 'flutterwave') NOT NULL,
    `providerPaymentMethod` ENUM('card', 'mobile_money_franco') NULL,
    `mobileOperator` VARCHAR(191) NULL,
    `paymentProviderId` VARCHAR(191) NULL,
    `meta` JSON NULL,
    `errors` JSON NULL,
    `webhookPayloads` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,
    `updatedById` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `PaymentPackage_reference_key`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchasePackage` (
    `id` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,
    `updatedById` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
