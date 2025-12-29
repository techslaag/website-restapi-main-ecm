-- Migration pour ajouter la période "week" et améliorer les essais gratuits
-- Date: 2024-11-29

-- Ajouter 'week' à l'enum SubscriptionPeriod
ALTER TABLE `Subscription` MODIFY `period` ENUM('month', 'year', 'week') NOT NULL DEFAULT 'month';

-- Ajouter un champ pour le prix de l'essai (toujours 0.0 pour les essais gratuits)
ALTER TABLE `Subscription`
ADD COLUMN `trialPrice` DECIMAL(12, 2) DEFAULT 0.00;

-- Ajouter un index pour optimiser les requêtes sur les essais actifs
CREATE INDEX `Subscription_isTrial_period_trialEnd_idx` ON `Subscription`(`isTrial`, `period`, `trialEnd`);

-- Mettre à jour tous les essais existants pour avoir un prix de 0.0 et période week
UPDATE `Subscription` 
SET 
  `trialPrice` = 0.00,
  `period` = 'week'
WHERE `isTrial` = true;