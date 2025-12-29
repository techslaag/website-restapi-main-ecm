/*
  Warnings:

  - You are about to drop the column `energyId` on the `energy` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[successorId]` on the table `Energy` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `Energy_energyId_key` ON `Energy`;

-- AlterTable
ALTER TABLE `Energy` DROP COLUMN `energyId`,
    ADD COLUMN `successorId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Energy_successorId_key` ON `Energy`(`successorId`);
