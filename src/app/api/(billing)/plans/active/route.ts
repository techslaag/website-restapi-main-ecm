import IPaginateResponse from "@/interfaces/IPaginateResponse";
import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils/index";
import { Plan, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const whereQuery: Prisma.PlanWhereInput = {
    archivedAt: null, // exclude archived post
  };

  const plans = await prisma.plan.findMany({
    where: whereQuery,
    orderBy: {
      monthlyPrice: "asc",
    },
    select: {
      id: true,
      planType: true,
      title: true,
      description: true,
      monthlyPrice: true,
      yearlyPrice: true,
      biweeklyDigitalPreview: true,
      magazineDigitalPreview: true,
      specialIssuesDigitalPreview: true,
      digitalBiweeklyVersion: true,
      digitalMagazineVersion: true,
      digitalSpecialIssuesVersion: true,
      physicalBiweeklyVersion: true,
      physicalMagazineVersion: true,
      physicalSpecialIssuesVersion: true,
      premiumPosts: true,
      exclusivity: true,
      amountCurrency: true,
      upgradable: true,
      // Champs d'essai gratuit
      isTrialEligible: true,
      trialDurationDays: true,
      trialFeatures: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Response.json(toSafeJSON<IPaginateResponse<Plan>>(plans));
}
