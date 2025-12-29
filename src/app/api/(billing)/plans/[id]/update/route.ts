import adminMiddleware from "@/lib/auth/adminMiddleware";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { Currency, PlanType } from "@prisma/client";
import { serializeError } from "serialize-error";
import { z } from "zod";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// validation schema
const schema = z.object({
  planType: z.enum([PlanType.premium, PlanType.ecomember]).optional(),
  title: z
    .string()
    .min(5, "Le titre est requis")
    .max(100, "La valeur ne peut pas excéder 100 caractères.")
    .optional(),
  description: z
    .string()
    .min(15, "Une description est necessaire")
    .max(500, "La valeur ne peut pas excéder 500 caractères.")
    .optional()
    .nullable(),
  digitalBiweeklyVersion: z.boolean().optional(),
  digitalMagazineVersion: z.boolean().optional(),
  digitalSpecialIssuesVersion: z.boolean().optional(),
  biweeklyDigitalPreview: z.boolean().optional(),
  magazineDigitalPreview: z.boolean().optional(),
  specialIssuesDigitalPreview: z.boolean().optional(),
  physicalBiweeklyVersion: z.boolean().optional(),
  physicalMagazineVersion: z.boolean().optional(),
  physicalSpecialIssuesVersion: z.boolean().optional(),
  premiumPosts: z.boolean().optional(),
  exclusivity: z.boolean().optional(),
  monthlyPrice: z
    .number()
    .positive("Un prix doit être un nombre positif.")
    .optional(),
  yearlyPrice: z
    .number()
    .positive("Un prix doit être un nombre positif.")
    .optional(),
  amountCurrency: z
    .enum([Currency.xaf, Currency.xof, Currency.usd, Currency.eur])
    .optional(),
  upgradable: z.boolean().optional(),
});

export async function PUT(
  req: Request,
  { params: { id: planId } }: { params: { id: string } },
) {
  return adminMiddleware(req, async (user) => {
    try {
      // load plan
      const plan = await prisma.plan.findUnique({ where: { id: planId } });

      // plan exists
      if (plan) {
        // archived plan modification is not allowed
        if (plan.archivedAt) {
          return Response.json(
            {
              message:
                "La modification d'une offre archivée n'est pas autorisée.",
            },
            { status: 400 },
          );
        } else {
          // extract and validate the request body
          const bodyPayload = schema.parse(await requestJsonBody(req));

          // we need the transaction so that if one request fail the plan remains unchanged
          const newPlan = await prisma.$transaction(async (tsx) => {
            // archive a plan so that the customers associated to this plan will not be affected by the changes
            await tsx.plan.update({
              where: { id: planId },
              data: {
                updatedAt: new Date(),
                archivedAt: new Date(),
                updatedById: user.id,
              },
            });

            // creation of the new plan with the new changes
            return await tsx.plan.create({
              data: {
                planType: bodyPayload.planType ?? plan.planType,
                title: bodyPayload.title ?? plan.title,
                description:
                  bodyPayload.description === null
                    ? null
                    : bodyPayload.description ?? plan.description,
                // digital versions
                digitalBiweeklyVersion:
                  bodyPayload.digitalBiweeklyVersion ??
                  plan.digitalBiweeklyVersion,
                digitalMagazineVersion:
                  bodyPayload.digitalMagazineVersion ??
                  plan.digitalMagazineVersion,
                digitalSpecialIssuesVersion:
                  bodyPayload.digitalSpecialIssuesVersion ??
                  plan.digitalSpecialIssuesVersion,
                // physical versions
                physicalBiweeklyVersion:
                  bodyPayload.physicalBiweeklyVersion ??
                  plan.physicalBiweeklyVersion,
                physicalMagazineVersion:
                  bodyPayload.physicalMagazineVersion ??
                  plan.physicalMagazineVersion,
                physicalSpecialIssuesVersion:
                  bodyPayload.physicalSpecialIssuesVersion ??
                  plan.physicalSpecialIssuesVersion,
                // digital versions preview
                biweeklyDigitalPreview:
                  bodyPayload.biweeklyDigitalPreview ??
                  plan.biweeklyDigitalPreview,
                magazineDigitalPreview:
                  bodyPayload.magazineDigitalPreview ??
                  plan.magazineDigitalPreview,
                specialIssuesDigitalPreview:
                  bodyPayload.specialIssuesDigitalPreview ??
                  plan.specialIssuesDigitalPreview,
                premiumPosts: bodyPayload.premiumPosts ?? plan.premiumPosts,
                exclusivity: bodyPayload.exclusivity ?? plan.exclusivity,
                monthlyPrice: bodyPayload.monthlyPrice ?? plan.monthlyPrice,
                yearlyPrice: bodyPayload.yearlyPrice ?? plan.yearlyPrice,
                amountCurrency:
                  bodyPayload.amountCurrency ?? plan.amountCurrency,
                upgradable: bodyPayload.upgradable ?? plan.upgradable,
                updatedAt: new Date(),
                updatedById: user.id,
              },
            });
          });

          return Response.json(newPlan, { status: 201 });
        }
      } else {
        return Response.json(
          {
            message: "Offre introuvable.",
          },
          { status: 404 },
        );
      }
    } catch (error) {
      return errorResponse(serializeError(error), {
        status: 500,
      });
    }
  });
}
