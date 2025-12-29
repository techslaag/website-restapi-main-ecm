-- DropIndex
DROP INDEX `Session_sessionToken_key` ON `Session`;

-- AlterTable
ALTER TABLE `Session` MODIFY `sessionToken` TEXT NOT NULL;
