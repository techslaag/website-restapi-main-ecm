-- AlterTable
ALTER TABLE `User` ADD COLUMN `signUpType` ENUM('registered', 'created') NOT NULL DEFAULT 'registered';
