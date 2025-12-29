import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: planId } }: { params: { id: string } },
) {
  // load plan
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
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
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
    },
  });

  // plan exists
  if (plan) {
    return Response.json(plan);
  } else {
    return Response.json(
      {
        message: "Offre introuvable.",
      },
      { status: 404 },
    );
  }
}
