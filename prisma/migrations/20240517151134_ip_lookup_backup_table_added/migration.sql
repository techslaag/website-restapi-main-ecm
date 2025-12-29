-- CreateTable
CREATE TABLE `IpLookupBackup` (
    `id` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NOT NULL,
    `countryCode` VARCHAR(191) NOT NULL,
    `countryName` VARCHAR(191) NULL,
    `currencyCode` VARCHAR(191) NOT NULL,
    `timeZones` VARCHAR(191) NULL,
    `isProxy` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
