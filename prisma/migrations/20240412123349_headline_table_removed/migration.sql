/*
  Warnings:

  - You are about to drop the column `headlineId` on the `headingpost` table. All the data in the column will be lost.
  - You are about to drop the `headline` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE `HeadingPost` DROP COLUMN `headlineId`,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- DropTable
DROP TABLE `Headline`;
