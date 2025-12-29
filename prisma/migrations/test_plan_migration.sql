-- Universal Test Plans for All Payment Methods
-- This migration adds test plans that can be used for testing all payment methods:
-- Stripe cards, Flutterwave mobile money, MyCoolPay, etc.

INSERT INTO Plan (
  id,
  planType,
  title,
  description,
  digitalBiweeklyVersion,
  digitalMagazineVersion, 
  digitalSpecialIssuesVersion,
  physicalBiweeklyVersion,
  physicalMagazineVersion,
  physicalSpecialIssuesVersion,
  biweeklyDigitalPreview,
  magazineDigitalPreview,
  specialIssuesDigitalPreview,
  premiumPosts,
  exclusivity,
  monthlyPrice,
  yearlyPrice,
  amountCurrency,
  upgradable,
  createdAt,
  updatedAt
) VALUES (
  'test_payment_plan_002',
  'ecomember',
  '🧪 Plan Test Ecomember',
  'Plan de test ecomember pour tous les modes de paiement. Fonctionnalités essentielles pour 1€/mois, converti automatiquement selon votre devise locale.',
  true,  -- digitalBiweeklyVersion
  true,  -- digitalMagazineVersion
  true,  -- digitalSpecialIssuesVersion
  false, -- physicalBiweeklyVersion
  false, -- physicalMagazineVersion
  false, -- physicalSpecialIssuesVersion
  true,  -- biweeklyDigitalPreview
  true,  -- magazineDigitalPreview
  true,  -- specialIssuesDigitalPreview
  true,  -- premiumPosts
  true,  -- exclusivity
  1.00,    -- monthlyPrice (EUR)
  1.00,    -- yearlyPrice (EUR) 
  'eur',   -- amountCurrency
  false,   -- upgradable
  NOW(),   -- createdAt
  NOW()    -- updatedAt
) ON DUPLICATE KEY UPDATE
  monthlyPrice = VALUES(monthlyPrice),
  yearlyPrice = VALUES(yearlyPrice),
  amountCurrency = VALUES(amountCurrency),
  updatedAt = NOW();

-- Also add a basic test plan
INSERT INTO Plan (
  id,
  planType,
  title,
  description,
  digitalBiweeklyVersion,
  digitalMagazineVersion, 
  digitalSpecialIssuesVersion,
  physicalBiweeklyVersion,
  physicalMagazineVersion,
  physicalSpecialIssuesVersion,
  biweeklyDigitalPreview,
  magazineDigitalPreview,
  specialIssuesDigitalPreview,
  premiumPosts,
  exclusivity,
  monthlyPrice,
  yearlyPrice,
  amountCurrency,
  upgradable,
  createdAt,
  updatedAt
) VALUES (
  'test_payment_plan_001',
  'premium',
  '🧪 Plan Test Premium',
  'Plan de test pour tous les modes de paiement (cartes, mobile money, etc.). Accès complet pour 1€/mois, converti automatiquement selon votre devise locale.',
  true,  -- digitalBiweeklyVersion
  false, -- digitalMagazineVersion
  false, -- digitalSpecialIssuesVersion
  false, -- physicalBiweeklyVersion
  false, -- physicalMagazineVersion
  false, -- physicalSpecialIssuesVersion
  true,  -- biweeklyDigitalPreview
  false, -- magazineDigitalPreview
  false, -- specialIssuesDigitalPreview
  true,  -- premiumPosts
  false, -- exclusivity
  1.00,    -- monthlyPrice (EUR)
  1.00,    -- yearlyPrice (EUR)
  'eur',   -- amountCurrency
  true,    -- upgradable
  NOW(),   -- createdAt
  NOW()    -- updatedAt
) ON DUPLICATE KEY UPDATE
  monthlyPrice = VALUES(monthlyPrice),
  yearlyPrice = VALUES(yearlyPrice),
  amountCurrency = VALUES(amountCurrency),
  updatedAt = NOW();