-- Migration pour mettre à jour le prix mensuel premium à 9.9 EUR
-- Date: 2024-11-24

-- Mettre à jour le plan premium existant avec le nouveau prix mensuel
UPDATE `Plan` 
SET 
  `monthlyPrice` = 9.90,
  `amountCurrency` = 'eur',
  `updatedAt` = NOW()
WHERE `planType` = 'premium' 
  AND `archivedAt` IS NULL;

-- Si aucun plan premium n'existe, en créer un
INSERT IGNORE INTO `Plan` (
  `id`,
  `planType`,
  `title`,
  `description`,
  `digitalBiweeklyVersion`,
  `digitalMagazineVersion`,
  `digitalSpecialIssuesVersion`,
  `physicalBiweeklyVersion`,
  `physicalMagazineVersion`,
  `physicalSpecialIssuesVersion`,
  `biweeklyDigitalPreview`,
  `magazineDigitalPreview`,
  `specialIssuesDigitalPreview`,
  `premiumPosts`,
  `exclusivity`,
  `monthlyPrice`,
  `yearlyPrice`,
  `amountCurrency`,
  `upgradable`,
  `isTrialEligible`,
  `trialDurationDays`,
  `trialFeatures`,
  `createdAt`,
  `updatedAt`
) 
SELECT 
  'clxxxxxxxxxxxxxxxxxx' as id, -- Générer un nouvel ID si nécessaire
  'premium' as planType,
  'EcoMatin Premium' as title,
  'Accès illimité aux contenus exclusifs et analyses approfondies' as description,
  true as digitalBiweeklyVersion,
  true as digitalMagazineVersion,
  true as digitalSpecialIssuesVersion,
  false as physicalBiweeklyVersion,
  false as physicalMagazineVersion,
  false as physicalSpecialIssuesVersion,
  true as biweeklyDigitalPreview,
  true as magazineDigitalPreview,
  true as specialIssuesDigitalPreview,
  true as premiumPosts,
  true as exclusivity,
  9.90 as monthlyPrice,
  99.00 as yearlyPrice, -- 10 mois au prix de 12 (économie de ~17%)
  'eur' as amountCurrency,
  false as upgradable,
  true as isTrialEligible,
  7 as trialDurationDays,
  JSON_ARRAY(
    'Articles premium exclusifs',
    'Magazines numériques', 
    'Newsletters spécialisées',
    'Analyses économiques approfondies',
    'Accès anticipé aux publications'
  ) as trialFeatures,
  NOW() as createdAt,
  NOW() as updatedAt
WHERE NOT EXISTS (
  SELECT 1 FROM `Plan` WHERE `planType` = 'premium' AND `archivedAt` IS NULL
);

-- Vérification : afficher les plans mis à jour
SELECT 
  id,
  planType,
  title,
  monthlyPrice,
  yearlyPrice,
  amountCurrency,
  isTrialEligible,
  trialDurationDays
FROM `Plan` 
WHERE `archivedAt` IS NULL 
ORDER BY `planType`, `monthlyPrice`;