import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/(billing)/plans/trial-eligible
 * Récupérer tous les plans éligibles à l'essai gratuit
 */
export async function GET(request: NextRequest) {
  try {
    // Récupérer tous les plans actifs qui proposent un essai
    const trialEligiblePlans = await prisma.plan.findMany({
      where: {
        archivedAt: null, // Plans non archivés
        isTrialEligible: true,
        trialDurationDays: { not: null },
      },
      orderBy: [
        { planType: 'asc' }, // premium avant ecomember
        { monthlyPrice: 'asc' }, // Prix croissant
      ],
    });

    // Transformer les données pour le frontend
    const plans = trialEligiblePlans.map(plan => ({
      id: plan.id,
      planType: plan.planType,
      title: plan.title,
      description: plan.description,
      monthlyPrice: plan.monthlyPrice.toString(),
      yearlyPrice: plan.yearlyPrice.toString(),
      amountCurrency: plan.amountCurrency,
      
      // Fonctionnalités
      digitalBiweeklyVersion: plan.digitalBiweeklyVersion,
      digitalMagazineVersion: plan.digitalMagazineVersion,
      digitalSpecialIssuesVersion: plan.digitalSpecialIssuesVersion,
      physicalBiweeklyVersion: plan.physicalBiweeklyVersion,
      physicalMagazineVersion: plan.physicalMagazineVersion,
      physicalSpecialIssuesVersion: plan.physicalSpecialIssuesVersion,
      biweeklyDigitalPreview: plan.biweeklyDigitalPreview,
      magazineDigitalPreview: plan.magazineDigitalPreview,
      specialIssuesDigitalPreview: plan.specialIssuesDigitalPreview,
      premiumPosts: plan.premiumPosts,
      exclusivity: plan.exclusivity,
      upgradable: plan.upgradable,
      
      // Spécifique à l'essai
      isTrialEligible: plan.isTrialEligible,
      trialDurationDays: plan.trialDurationDays,
      trialFeatures: plan.trialFeatures,
      
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      plans,
      count: plans.length,
    });

  } catch (error) {
    console.error("Erreur lors de la récupération des plans d'essai:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "Erreur interne du serveur" 
      },
      { status: 500 }
    );
  }
}