import { Plan, Subscription, Subscription_period } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface UpgradeCalculation {
  currentPlan: Plan;
  targetPlan: Plan;
  currentSubscription: Subscription;
  remainingValue: number;
  upgradePrice: number;
  finalPrice: number;
  remainingDays: number;
  usedDays: number;
  totalDays: number;
  description: string;
}

/**
 * Calculate the upgrade pricing when switching from premium to ecomembre
 * Logic: Take remaining unused premium value and subtract it from ecomembre price
 * Enhanced with additional validations and security checks
 */
export function calculateUpgradePrice(
  currentSubscription: Subscription & { plan: Plan },
  targetPlan: Plan
): UpgradeCalculation {
  // Input validation
  if (!currentSubscription || !currentSubscription.plan || !targetPlan) {
    throw new Error("Invalid subscription or plan data provided");
  }

  if (!currentSubscription.expiresAt || !currentSubscription.createdAt) {
    throw new Error("Invalid subscription dates");
  }

  const currentPlan = currentSubscription.plan;
  const now = new Date();
  const expiresAt = new Date(currentSubscription.expiresAt);
  const createdAt = new Date(currentSubscription.createdAt);

  // Validate date logic
  if (expiresAt <= createdAt) {
    throw new Error("Invalid subscription date range");
  }

  if (now >= expiresAt) {
    throw new Error("Cannot calculate upgrade for expired subscription");
  }

  if (now < createdAt) {
    throw new Error("Invalid subscription timing");
  }

  // Calculate time periods
  const totalSubscriptionTime = expiresAt.getTime() - createdAt.getTime();
  const usedTime = now.getTime() - createdAt.getTime();
  const remainingTime = expiresAt.getTime() - now.getTime();

  const totalDays = Math.ceil(totalSubscriptionTime / (1000 * 60 * 60 * 24));
  const usedDays = Math.ceil(usedTime / (1000 * 60 * 60 * 24));
  const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));

  // Validate pricing data exists and is reasonable
  if (!currentPlan.yearlyPrice || !currentPlan.monthlyPrice || !targetPlan.yearlyPrice || !targetPlan.monthlyPrice) {
    throw new Error("Missing pricing information for plans");
  }

  // Get the price that was paid for the current subscription
  const paidPrice = currentSubscription.period === 'year' 
    ? currentPlan.yearlyPrice 
    : currentPlan.monthlyPrice;

  // Validate paid price is reasonable
  const paidPriceNumber = Number(paidPrice);
  if (isNaN(paidPriceNumber) || paidPriceNumber <= 0 || paidPriceNumber > 10000) {
    throw new Error("Invalid paid price detected");
  }

  // Calculate remaining value with additional validations
  let remainingValue: number;

  if (currentSubscription.period === 'year') {
    // For yearly subscriptions, calculate daily rate and remaining value
    const dailyRate = Number(paidPrice) / totalDays;
    remainingValue = dailyRate * remainingDays;
  } else {
    // For monthly subscriptions
    const remainingMonths = Math.ceil(remainingDays / 30);
    
    // If user has used 1-2 weeks, count as 1 full month used
    if (usedDays >= 7 && usedDays < 30) {
      remainingValue = 0; // Count the month as fully used
    } else {
      remainingValue = Number(paidPrice) * (remainingMonths / Math.ceil(totalDays / 30));
    }
  }

  // Calculate target plan price for the same period
  const targetPlanPrice = currentSubscription.period === 'year' 
    ? Number(targetPlan.yearlyPrice)
    : Number(targetPlan.monthlyPrice);

  // Validate target plan price
  if (isNaN(targetPlanPrice) || targetPlanPrice <= 0 || targetPlanPrice > 10000) {
    throw new Error("Invalid target plan price");
  }

  // Calculate upgrade price with bounds checking
  const upgradePrice = targetPlanPrice - remainingValue;
  const finalPrice = Math.max(0, Math.min(upgradePrice, targetPlanPrice)); // Ensure price is reasonable

  // Additional validation: ensure remaining value doesn't exceed paid price
  if (remainingValue > paidPriceNumber) {
    throw new Error("Calculated remaining value exceeds paid amount");
  }

  // Validate final calculations
  if (isNaN(finalPrice) || finalPrice < 0) {
    throw new Error("Invalid final price calculation");
  }

  return {
    currentPlan,
    targetPlan,
    currentSubscription,
    remainingValue: Math.round(remainingValue * 100) / 100,
    upgradePrice: Math.round(upgradePrice * 100) / 100,
    finalPrice: Math.round(finalPrice * 100) / 100,
    remainingDays,
    usedDays,
    totalDays,
    description: generateUpgradeDescription(
      currentPlan,
      targetPlan,
      remainingDays,
      Math.round(remainingValue * 100) / 100,
      Math.round(finalPrice * 100) / 100,
      currentSubscription.period
    )
  };
}

function generateUpgradeDescription(
  currentPlan: Plan,
  targetPlan: Plan,
  remainingDays: number,
  remainingValue: number,
  finalPrice: number,
  period: Subscription_period
): string {
  const periodText = period === 'year' ? 'annuel' : 'mensuel';
  const remainingText = period === 'year' 
    ? `${remainingDays} jours restants`
    : `${Math.ceil(remainingDays / 30)} mois restants`;

  return `Mise à niveau de ${currentPlan.title} vers ${targetPlan.title}. ` +
    `Crédit restant de votre abonnement ${periodText}: ${remainingValue}€ (${remainingText}). ` +
    `Prix final après déduction: ${finalPrice}€.`;
}

/**
 * Check if a subscription is eligible for upgrade with enhanced security validations
 */
export function isEligibleForUpgrade(
  subscription: Subscription & { plan: Plan },
  targetPlanType: string
): { eligible: boolean; reason?: string } {
  // Input validation
  if (!subscription || !subscription.plan) {
    return {
      eligible: false,
      reason: "Invalid subscription data"
    };
  }

  if (!targetPlanType || typeof targetPlanType !== 'string') {
    return {
      eligible: false,
      reason: "Invalid target plan type"
    };
  }

  // Sanitize target plan type
  const sanitizedTargetPlan = targetPlanType.trim().toLowerCase();
  if (!['ecomember'].includes(sanitizedTargetPlan)) {
    return {
      eligible: false,
      reason: "Unsupported target plan type"
    };
  }

  const now = new Date();
  
  // Validate subscription dates
  if (!subscription.expiresAt) {
    return {
      eligible: false,
      reason: "Invalid subscription expiry date"
    };
  }

  const expiresAt = new Date(subscription.expiresAt);
  if (isNaN(expiresAt.getTime())) {
    return {
      eligible: false,
      reason: "Invalid subscription expiry date format"
    };
  }

  // Check if subscription is still active with buffer time
  if (expiresAt <= now) {
    return {
      eligible: false,
      reason: "Subscription has expired"
    };
  }

  // Check minimum remaining time (e.g., at least 1 day)
  const remainingTime = expiresAt.getTime() - now.getTime();
  const minimumRemainingTime = 24 * 60 * 60 * 1000; // 24 hours
  if (remainingTime < minimumRemainingTime) {
    return {
      eligible: false,
      reason: "Insufficient remaining subscription time for upgrade"
    };
  }

  // Check if it's a trial subscription
  if (subscription.isTrial) {
    return {
      eligible: false,
      reason: "Trial subscriptions cannot be upgraded"
    };
  }

  // Validate current plan
  if (!subscription.plan.planType) {
    return {
      eligible: false,
      reason: "Invalid current plan type"
    };
  }

  const currentPlanType = subscription.plan.planType.toLowerCase();
  
  // Check if already on target plan or higher
  if (currentPlanType === sanitizedTargetPlan) {
    return {
      eligible: false,
      reason: "Already subscribed to this plan"
    };
  }

  // Check if plan is archived or inactive
  if (subscription.plan.archivedAt) {
    return {
      eligible: false,
      reason: "Current plan is no longer active"
    };
  }

  // Define upgrade hierarchy and valid paths
  const validUpgradePaths: Record<string, string[]> = {
    'premium': ['ecomember'],
    // Add more upgrade paths as needed
  };

  const allowedTargets = validUpgradePaths[currentPlanType];
  if (!allowedTargets || !allowedTargets.includes(sanitizedTargetPlan)) {
    return {
      eligible: false,
      reason: `Upgrade from ${currentPlanType} to ${sanitizedTargetPlan} is not allowed`
    };
  }

  // Check if subscription was recently upgraded (prevent rapid upgrades)
  if (subscription.upgradedAt) {
    const upgradedAt = new Date(subscription.upgradedAt);
    const timeSinceUpgrade = now.getTime() - upgradedAt.getTime();
    const minimumUpgradeInterval = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    if (timeSinceUpgrade < minimumUpgradeInterval) {
      return {
        eligible: false,
        reason: "Subscription was recently upgraded. Please wait before upgrading again."
      };
    }
  }

  return { 
    eligible: true,
    reason: "Eligible for upgrade"
  };
}

/**
 * Get the target ecomembre plan
 */
export async function getEcomembrePlan(prisma: any): Promise<Plan | null> {
  const ecomembrePlan = await prisma.plan.findFirst({
    where: {
      planType: 'ecomember',
      archivedAt: null // Only active plans
    }
  });
  
  return ecomembrePlan;
}