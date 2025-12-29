-- CreateTable
CREATE TABLE `AbandonedSubscription` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `planId` VARCHAR(191) NOT NULL,
    `period` ENUM('month', 'year') NOT NULL DEFAULT 'month',
    `email` VARCHAR(191) NULL,
    `step` ENUM('plan_selection', 'user_registration', 'payment_method', 'payment_processing', 'payment_failed', 'email_verification') NOT NULL,
    `status` ENUM('abandoned', 'recovered', 'expired') NOT NULL DEFAULT 'abandoned',
    `userAgent` TEXT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `referrer` TEXT NULL,
    `utmSource` VARCHAR(191) NULL,
    `utmMedium` VARCHAR(191) NULL,
    `utmCampaign` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `abandonedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `recoveredAt` DATETIME(3) NULL,
    `completedSubscriptionId` VARCHAR(191) NULL,
    `remindersSent` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
);

-- CreateTable
CREATE TABLE `AbandonedSubscriptionActivity` (
    `id` VARCHAR(191) NOT NULL,
    `abandonedSubscriptionId` VARCHAR(191) NOT NULL,
    `step` ENUM('plan_selection', 'user_registration', 'payment_method', 'payment_processing', 'payment_failed', 'email_verification') NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
);

-- CreateIndex
CREATE INDEX `AbandonedSubscription_sessionId_idx` ON `AbandonedSubscription`(`sessionId`);

-- CreateIndex
CREATE INDEX `AbandonedSubscription_userId_idx` ON `AbandonedSubscription`(`userId`);

-- CreateIndex
CREATE INDEX `AbandonedSubscription_email_idx` ON `AbandonedSubscription`(`email`);

-- CreateIndex
CREATE INDEX `AbandonedSubscription_planId_idx` ON `AbandonedSubscription`(`planId`);

-- CreateIndex
CREATE INDEX `AbandonedSubscription_status_idx` ON `AbandonedSubscription`(`status`);

-- CreateIndex
CREATE INDEX `AbandonedSubscription_step_idx` ON `AbandonedSubscription`(`step`);

-- CreateIndex
CREATE INDEX `AbandonedSubscription_abandonedAt_idx` ON `AbandonedSubscription`(`abandonedAt`);

-- CreateIndex
CREATE INDEX `AbandonedSubscriptionActivity_abandonedSubscriptionId_idx` ON `AbandonedSubscriptionActivity`(`abandonedSubscriptionId`);

-- CreateIndex
CREATE INDEX `AbandonedSubscriptionActivity_step_idx` ON `AbandonedSubscriptionActivity`(`step`);