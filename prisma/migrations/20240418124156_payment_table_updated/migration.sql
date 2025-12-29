/*
  Warnings:

  - You are about to drop the column `expiredAt` on the `subscription` table. All the data in the column will be lost.
  - Added the required column `expiresAt` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Subscription` DROP COLUMN `expiredAt`,
    ADD COLUMN `expiresAt` DATETIME(3) NOT NULL;
