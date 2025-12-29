/*
  Warnings:

  - Added the required column `biweeklyDigitalPreview` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `magazineDigitalPreview` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `physicalBiweeklyVersion` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `physicalSpecialIssuesVersion` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `premiumPosts` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `specialIssuesDigitalPreview` to the `Plan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Plan` ADD COLUMN `biweeklyDigitalPreview` BOOLEAN NOT NULL,
    ADD COLUMN `magazineDigitalPreview` BOOLEAN NOT NULL,
    ADD COLUMN `physicalBiweeklyVersion` BOOLEAN NOT NULL,
    ADD COLUMN `physicalSpecialIssuesVersion` BOOLEAN NOT NULL,
    ADD COLUMN `premiumPosts` BOOLEAN NOT NULL,
    ADD COLUMN `specialIssuesDigitalPreview` BOOLEAN NOT NULL;
