-- CreateTable
CREATE TABLE `InterestCategory` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InterestCategory_slug_key`(`slug`),
    INDEX `InterestCategory_slug_idx`(`slug`),
    INDEX `InterestCategory_order_idx`(`order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Update Interest table to use proper foreign key
-- First, update all existing interests to have null categoryId
UPDATE `Interest` SET `categoryId` = NULL;

-- Insert default categories
INSERT INTO `InterestCategory` (`id`, `name`, `slug`, `description`, `order`, `isActive`, `createdAt`, `updatedAt`) VALUES
('cat_rubriques', 'Rubriques', 'rubriques', 'Rubriques éditoriales principales', 1, true, NOW(), NOW()),
('cat_zones_geo', 'Zones géographiques', 'zones-geographiques', 'Couverture géographique par pays', 2, true, NOW(), NOW()),
('cat_autres', 'Autres', 'autres', 'Autres centres d\'intérêt', 3, true, NOW(), NOW());

-- Add foreign key constraint
ALTER TABLE `Interest` ADD CONSTRAINT `Interest_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `InterestCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;