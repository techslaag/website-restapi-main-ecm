/*
  Warnings:

  - A unique constraint covering the columns `[currency]` on the table `CurrencyExchangeRates` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `CurrencyExchangeRates_currency_key` ON `CurrencyExchangeRates`(`currency`);
