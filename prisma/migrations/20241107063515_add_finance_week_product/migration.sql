-- CreateTable
CREATE TABLE `FinancialWeekUser` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `prenom` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `entreprise` VARCHAR(191) NOT NULL,
    `poste` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `package` ENUM('premium', 'partenaire', 'soutien') NULL,
    `password` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `FinancialWeekUser_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Package` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `currency` ENUM('xaf', 'xof', 'usd', 'eur', 'gbp') NOT NULL,
    `type` ENUM('premium', 'partenaire', 'soutien') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,
    `updatedById` VARCHAR(191) NULL,
    `archivedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
