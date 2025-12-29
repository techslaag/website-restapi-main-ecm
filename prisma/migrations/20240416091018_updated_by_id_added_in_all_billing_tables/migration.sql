-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `PaymentProvider` ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Plan` ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `PostPurchase` ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Subscription` ADD COLUMN `updatedById` VARCHAR(191) NULL;
