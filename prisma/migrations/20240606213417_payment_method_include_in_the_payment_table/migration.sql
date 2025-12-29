-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `providerPaymentMethod` ENUM('card', 'mobile_money_franco') NULL;
