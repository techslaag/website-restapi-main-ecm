/*
  Warnings:

  - You are about to drop the column `mod180_postsID` on the `postpurchase` table. All the data in the column will be lost.
  - Added the required column `postId` to the `PostPurchase` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Payment` MODIFY `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    MODIFY `receivedAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE `Plan` MODIFY `monthlyPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    MODIFY `yearlyPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE `PostPurchase` DROP COLUMN `mod180_postsID`,
    ADD COLUMN `postId` BIGINT UNSIGNED NOT NULL,
    MODIFY `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
