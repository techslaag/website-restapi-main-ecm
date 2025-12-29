import IPaginateResponse from "@/interfaces/IPaginateResponse";
import authMiddleware from "@/lib/auth/authMiddleware";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { Prisma, Subscription } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return authMiddleware(req, async (user) => {
    // extract query parameters
    const queryParams = extractQueryParams(req);

    const page = Number(queryParams.page ?? 1),
      limit = Number(queryParams.limit ?? 25);

    // query filter
    const whereQuery: Prisma.SubscriptionWhereInput = {
      userId: user.id,
    };

    // get the pagination meta data (page, limit, total pages)
    const paginationMeta = await getPaginationMetaData(
      "Subscription",
      page,
      limit,
      whereQuery,
    );

    const list = await prisma.subscription.findMany({
      where: whereQuery,
      ...paginationMeta.query,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        reference: true,
        period: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        // Trial fields
        isTrial: true,
        trialEnd: true,
        trialStarted: true,
        trialConvertedAt: true,
        trialPrice: true,
        plan: {
          select: {
            id: true,
            planType: true,
            title: true,
            description: true,
            amountCurrency: true,
            digitalBiweeklyVersion: true,
            digitalMagazineVersion: true,
            digitalSpecialIssuesVersion: true,
            biweeklyDigitalPreview: true,
            magazineDigitalPreview: true,
            specialIssuesDigitalPreview: true,
            physicalBiweeklyVersion: true,
            physicalMagazineVersion: true,
            physicalSpecialIssuesVersion: true,
            exclusivity: true,
            premiumPosts: true,
            monthlyPrice: true,
            yearlyPrice: true,
            updatedAt: true,
            archivedAt: true,
            upgradable: true,
          },
        },
        payment: {
          select: {
            id: true,
            provider: true,
            reference: true,
            paidAmount: true,
            status: true,
            paidAmountCurrency: true,
            createdAt: true,
          },
        },
      },
    });

    return Response.json(
      toSafeJSON<IPaginateResponse<Subscription>>({
        ...paginationMeta.meta,
        items: list,
      }),
    );
  });
}
