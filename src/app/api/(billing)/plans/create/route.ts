import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { Currency, PlanType } from "@prisma/client";
import { serializeError } from "serialize-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  planType: z.enum([PlanType.premium, PlanType.ecomember], {
    required_error: "Le type d'offre est requis.",
  }),
  title: z
    .string({ required_error: "Le titre est requis" })
    .min(5, "Le titre est requis")
    .max(100, "La valeur ne peut pas excéder 100 caractères."),
  description: z
    .string()
    .min(15, "Une description est necessaire")
    .max(500, "La valeur ne peut pas excéder 500 caractères.")
    .optional()
    .nullable(),
  digitalBiweeklyVersion: z.boolean({
    required_error:
      "Le champ accès aux versions numériques des bihebdomadaires est requis.",
  }),
  digitalMagazineVersion: z.boolean({
    required_error:
      "Le champ accès aux versions numériques des magazines est requis.",
  }),
  digitalSpecialIssuesVersion: z.boolean({
    required_error:
      "Le champ accès aux versions numériques des hors-séries est requis.",
  }),
  biweeklyDigitalPreview: z.boolean({
    required_error:
      "Le champ accès aux avant-premières des bihebdomadaires est requis.",
  }),
  magazineDigitalPreview: z.boolean({
    required_error:
      "Le champ accès aux avant-premières des magazines est requis.",
  }),
  specialIssuesDigitalPreview: z.boolean({
    required_error:
      "Le champ accès aux avant-premières des hors-séries est requis.",
  }),
  physicalBiweeklyVersion: z.boolean({
    required_error:
      "Le champ accès aux versions physiques des bihebdomadaires est requis.",
  }),
  physicalMagazineVersion: z.boolean({
    required_error:
      "Le champ accès aux versions physiques des magazines est requis.",
  }),
  physicalSpecialIssuesVersion: z.boolean({
    required_error:
      "Le champ accès aux versions physiques des hors-séries est requis.",
  }),
  premiumPosts: z.boolean({
    required_error: "Le champ accès aux posts premium est requis.",
  }),
  exclusivity: z.boolean({
    required_error: "Le champ accès aux ecomembre est requis.",
  }),
  monthlyPrice: z
    .number({ required_error: "Un prix à la mensualité est requis" })
    .positive("Un prix doit être un nombre positif."),
  yearlyPrice: z
    .number({ required_error: "Un prix sur l'année est requis" })
    .positive("Un prix doit être un nombre positif."),
  amountCurrency: z.enum(
    [Currency.xaf, Currency.xof, Currency.usd, Currency.eur],
    { required_error: "La devise de l'offre est requise." },
  ),
  upgradable: z.boolean({ required_error: "Le champ évolutive est requis." }),
});

export async function POST(req: Request) {
  return adminMiddleware(req, async (user) => {
    try {
      const bodyPayload = createSchema.parse(await requestJsonBody(req));

      // checking if and active plan with the same type exists to prevent duplication
      const existingActivePlan = await prisma.plan.findFirst({
        where: {
          planType: bodyPayload.planType,
          archivedAt: { not: null },
        },
      });

      // plan already exists
      if (existingActivePlan) {
        return Response.json(
          {
            message: `Une offre ${bodyPayload.planType} active existe déjà dans le système, modifiez-la directement ou archivez-la, retentez l'opération de création.`,
          },
          { status: 400 },
        );
      } else {
        // create the plan
        const plan = await prisma.plan.create({
          data: {
            planType: bodyPayload.planType,
            title: bodyPayload.title,
            description: bodyPayload.description,
            // digital versions
            digitalBiweeklyVersion: bodyPayload.digitalBiweeklyVersion,
            digitalMagazineVersion: bodyPayload.digitalMagazineVersion,
            digitalSpecialIssuesVersion:
              bodyPayload.digitalSpecialIssuesVersion,
            // digital version perview
            biweeklyDigitalPreview: bodyPayload.biweeklyDigitalPreview,
            magazineDigitalPreview: bodyPayload.magazineDigitalPreview,
            specialIssuesDigitalPreview:
              bodyPayload.specialIssuesDigitalPreview,
            // physical versions
            physicalBiweeklyVersion: bodyPayload.physicalBiweeklyVersion,
            physicalMagazineVersion: bodyPayload.physicalMagazineVersion,
            physicalSpecialIssuesVersion:
              bodyPayload.physicalSpecialIssuesVersion,
            premiumPosts: bodyPayload.premiumPosts,
            exclusivity: bodyPayload.exclusivity,
            monthlyPrice: bodyPayload.monthlyPrice,
            yearlyPrice: bodyPayload.yearlyPrice,
            amountCurrency: bodyPayload.amountCurrency,
            upgradable: bodyPayload.upgradable,
            updatedAt: new Date(),
            updatedById: user.id,
          },
        });

        return Response.json(plan);
      }
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
