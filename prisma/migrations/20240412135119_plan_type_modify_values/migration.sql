/*
  Warnings:

  - The values [PREMIUM,ECOMEMBER] on the enum `Plan_planType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `Plan` MODIFY `planType` ENUM('premium', 'ecomember') NOT NULL;
