-- Migration pour ajouter le support des essais gratuits 7 jours
-- Date: 2024-11-24

-- Ajout des champs d'essai au modèle Plan
ALTER TABLE `Plan` 
ADD COLUMN `trialDurationDays` INTEGER DEFAULT NULL,
ADD COLUMN `isTrialEligible` BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN `trialFeatures` JSON DEFAULT NULL;

-- Ajout des champs d'essai au modèle Subscription  
ALTER TABLE `Subscription`
ADD COLUMN `isTrial` BOOLEAN DEFAULT false,
ADD COLUMN `trialEnd` DATETIME(3) DEFAULT NULL,
ADD COLUMN `trialStarted` DATETIME(3) DEFAULT NULL,
ADD COLUMN `trialConvertedAt` DATETIME(3) DEFAULT NULL;

-- Ajout des champs de rappel d'essai au modèle User
ALTER TABLE `User`
ADD COLUMN `trialReminderSentAt` DATETIME(3) DEFAULT NULL,
ADD COLUMN `trialSecondReminderSentAt` DATETIME(3) DEFAULT NULL,
ADD COLUMN `trialFinalReminderSentAt` DATETIME(3) DEFAULT NULL;

-- Index pour optimiser les requêtes sur les essais
CREATE INDEX `Subscription_isTrial_trialEnd_idx` ON `Subscription`(`isTrial`, `trialEnd`);
CREATE INDEX `Subscription_userId_isTrial_idx` ON `Subscription`(`userId`, `isTrial`);
CREATE INDEX `Plan_isTrialEligible_idx` ON `Plan`(`isTrialEligible`);

-- Mise à jour des plans existants pour activer l'essai (exemple)
-- Activer l'essai 7 jours pour les plans premium
UPDATE `Plan` 
SET 
  `isTrialEligible` = true,
  `trialDurationDays` = 7,
  `trialFeatures` = JSON_ARRAY(
    'Articles premium exclusifs',
    'Magazines numériques',
    'Newsletters spécialisées',
    'Analyses économiques approfondies'
  )
WHERE `planType` = 'premium' AND `archivedAt` IS NULL;

-- Ne pas activer l'essai pour les plans ecomember de base
UPDATE `Plan` 
SET 
  `isTrialEligible` = false,
  `trialDurationDays` = NULL,
  `trialFeatures` = NULL
WHERE `planType` = 'ecomember' AND `archivedAt` IS NULL;