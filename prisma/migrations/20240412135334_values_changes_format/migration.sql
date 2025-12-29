/*
  Warnings:

  - The values [XAF,XOF,USD,EUR] on the enum `PaymentProvider_currency` will be removed. If these variants are still used in the database, this will fail.
  - The values [XAF,XOF,USD,EUR] on the enum `PaymentProvider_currency` will be removed. If these variants are still used in the database, this will fail.
  - The values [XAF,XOF,USD,EUR] on the enum `PaymentProvider_currency` will be removed. If these variants are still used in the database, this will fail.
  - The values [CARD,MOBILE,DIGITAL_WALLET] on the enum `PaymentProvider_paymentType` will be removed. If these variants are still used in the database, this will fail.
  - The values [XAF,XOF,USD,EUR] on the enum `PaymentProvider_currency` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `Payment` MODIFY `paidAmountCurrent` ENUM('xaf', 'xof', 'usd', 'eur') NOT NULL,
    MODIFY `receivedCurrency` ENUM('xaf', 'xof', 'usd', 'eur') NOT NULL;

-- AlterTable
ALTER TABLE `PaymentProvider` MODIFY `currency` ENUM('xaf', 'xof', 'usd', 'eur') NOT NULL,
    MODIFY `PaymentType` ENUM('card', 'mobile', 'digital_wallet') NOT NULL;

-- AlterTable
ALTER TABLE `Plan` MODIFY `amountCurrency` ENUM('xaf', 'xof', 'usd', 'eur') NOT NULL;
