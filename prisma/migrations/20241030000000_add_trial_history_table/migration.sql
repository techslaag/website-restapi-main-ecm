-- CreateTable
CREATE TABLE `TrialHistory` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `subscriptionId` VARCHAR(191) NULL,
    `planId` VARCHAR(191) NOT NULL,
    `trialStarted` DATETIME(3) NOT NULL,
    `trialEnd` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TrialHistory_subscriptionId_key` (`subscriptionId`),
    INDEX `TrialHistory_userId_idx` (`userId`),
    INDEX `TrialHistory_email_idx` (`email`),
    INDEX `TrialHistory_ipAddress_idx` (`ipAddress`),
    INDEX `TrialHistory_createdAt_idx` (`createdAt`),
    INDEX `TrialHistory_email_ipAddress_idx` (`email`, `ipAddress`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TrialHistory` ADD CONSTRAINT `TrialHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrialHistory` ADD CONSTRAINT `TrialHistory_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrialHistory` ADD CONSTRAINT `TrialHistory_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;