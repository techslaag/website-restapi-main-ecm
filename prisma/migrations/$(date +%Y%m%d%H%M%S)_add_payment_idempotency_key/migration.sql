-- Add idempotency key to Payment table to prevent duplicate charges
ALTER TABLE `Payment` ADD COLUMN `idempotencyKey` VARCHAR(255) NULL;

-- Create unique index on idempotencyKey to ensure uniqueness
CREATE UNIQUE INDEX `Payment_idempotencyKey_key` ON `Payment`(`idempotencyKey`);