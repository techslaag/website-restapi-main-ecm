-- AlterTable
ALTER TABLE `Plan` ADD COLUMN `upgradable` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `description` VARCHAR(191) NULL;
