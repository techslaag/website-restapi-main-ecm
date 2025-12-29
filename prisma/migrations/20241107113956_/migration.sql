/*
  Warnings:

  - You are about to drop the column `email` on the `financialweekuser` table. All the data in the column will be lost.
  - You are about to drop the column `entreprise` on the `financialweekuser` table. All the data in the column will be lost.
  - You are about to drop the column `nom` on the `financialweekuser` table. All the data in the column will be lost.
  - You are about to drop the column `package` on the `financialweekuser` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `financialweekuser` table. All the data in the column will be lost.
  - You are about to drop the column `poste` on the `financialweekuser` table. All the data in the column will be lost.
  - You are about to drop the column `prenom` on the `financialweekuser` table. All the data in the column will be lost.
  - You are about to drop the `package` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `paymentpackage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `purchasepackage` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId]` on the table `FinancialWeekUser` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `enterprise` to the `FinancialWeekUser` table without a default value. This is not possible if the table is not empty.
  - Added the required column `job` to the `FinancialWeekUser` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `FinancialWeekUser` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `FinancialWeekUser_email_key` ON `FinancialWeekUser`;

-- AlterTable
ALTER TABLE `FinancialWeekUser` DROP COLUMN `email`,
    DROP COLUMN `entreprise`,
    DROP COLUMN `nom`,
    DROP COLUMN `package`,
    DROP COLUMN `password`,
    DROP COLUMN `poste`,
    DROP COLUMN `prenom`,
    ADD COLUMN `enterprise` VARCHAR(191) NOT NULL,
    ADD COLUMN `job` VARCHAR(191) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NULL,
    ADD COLUMN `userId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Purchase` MODIFY `entityType` ENUM('post', 'magazine', 'biweekly', 'special_issues', 'package') NOT NULL;

-- DropTable
DROP TABLE `Package`;

-- DropTable
DROP TABLE `PaymentPackage`;

-- DropTable
DROP TABLE `PurchasePackage`;

-- CreateIndex
CREATE UNIQUE INDEX `FinancialWeekUser_userId_key` ON `FinancialWeekUser`(`userId`);
