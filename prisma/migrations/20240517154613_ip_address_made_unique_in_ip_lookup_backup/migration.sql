/*
  Warnings:

  - A unique constraint covering the columns `[ipAddress]` on the table `IpLookupBackup` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `IpLookupBackup_ipAddress_key` ON `IpLookupBackup`(`ipAddress`);
