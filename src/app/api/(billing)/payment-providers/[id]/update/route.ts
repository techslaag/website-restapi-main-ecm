import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { Currency, PaymentType } from "@prisma/client";
import { serializeError } from "serialize-error";
import slugify from "slugify";
import { z } from "zod";

/**
 * @swagger
 * components:
 *   schemas:
 *     PaymentProviderUpdate:
 *       type: object
 *       properties:
 *         paymentType:
 *           type: string
 *           enum: [card, digital_wallet, mobile]
 *           description: Le type de paiement (carte, portefeuille numérique, mobile).
 *         currency:
 *           type: string
 *           enum: [xaf, xof, usd, eur]
 *           description: La devise utilisée pour le fournisseur de paiement.
 *         reference:
 *           type: string
 *           description: La référence du fournisseur de paiement.
 *         commonIdentifier:
 *           type: string
 *           description: L'identifiant commun du fournisseur de paiement.
 *         logoUrl:
 *           type: string
 *           format: uri
 *           description: L'URL du logo du fournisseur de paiement.
 *         name:
 *           type: string
 *           description: Le nom du fournisseur de paiement.
 *         countryAlpha2:
 *           type: string
 *           description: Le code alpha-2 du pays du fournisseur de paiement.
 *         countryAlpha3:
 *           type: string
 *           description: Le code alpha-3 du pays du fournisseur de paiement.
 *       required:
 *         - paymentType
 *         - currency
 *         - reference
 *         - commonIdentifier
 *         - logoUrl
 *         - name
 * /payment-provider/{id}:
 *   put:
 *     summary: Met à jour un fournisseur de paiement
 *     description: Met à jour les informations d'un fournisseur de paiement spécifique à partir de son ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: L'ID du fournisseur de paiement à mettre à jour.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentProviderUpdate'
 *     responses:
 *       200:
 *         description: Mise à jour réussie du fournisseur de paiement.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentProviderUpdate'
 *       400:
 *         description: Les données envoyées sont invalides ou manquantes.
 *       404:
 *         description: Le fournisseur de paiement avec l'ID spécifié n'a pas été trouvé.
 *       500:
 *         description: Une erreur interne s'est produite lors du traitement de la requête.
 */


export const dynamic = "force-dynamic";

const schema = z.object({
  paymentType: z
    .enum([PaymentType.card, PaymentType.digital_wallet, PaymentType.mobile])
    .optional(),
  currency: z
    .enum([Currency.xaf, Currency.xof, Currency.usd, Currency.eur])
    .optional(),
  reference: z
    .string()
    .min(2, "La reférence doit contenir au moins 2 caractères.")
    .max(100, "La valeur ne peut pas excéder 100 caractères.")
    .optional(),
  commonIdentifier: z
    .string()
    .min(2, "L'identifiant commun doit contenir au moins 2 caractères.")
    .max(100, "La valeur ne peut pas excéder 100 caractères.")
    .optional(),
  logoUrl: z
    .string()
    .url("L'adresse du logo n'est pas valide.")
    .optional()
    .nullable(),
  name: z
    .string()
    .min(2, "Le nom est doit contenir au moins 2 caractères.")
    .max(200, "La valeur ne peut pas excéder 200 caractères.")
    .optional(),
  countryAlpha2: z
    .string()
    .length(2, "Le code alpha 2 du pays ne contient que 2 caractères.")
    .optional(),
  countryAlpha3: z
    .string()
    .length(3, "Le code alpha 3 du pays ne contient que 2 caractères.")
    .optional(),
});

export async function PUT(
  req: Request,
  { params: { id: providerId } }: { params: { id: string } },
) {
  return adminMiddleware(req, async (user) => {
    try {
      // load provider
      let provider = await prisma.paymentProvider.findUnique({
        where: { id: providerId },
      });

      // provider exists
      if (provider) {
        // validate the request body
        const bodyPayload = schema.parse(await requestJsonBody(req));

        // update the payment provider
        provider = await prisma.paymentProvider.update({
          where: { id: provider.id },
          data: {
            countryAlpha2: bodyPayload.countryAlpha2 ?? provider.countryAlpha2,
            countryAlpha3: bodyPayload.countryAlpha3 ?? provider.countryAlpha3,
            currency: bodyPayload.currency ?? provider.currency,
            reference: bodyPayload.reference
              ? slugify(bodyPayload.reference.toLowerCase())
              : provider.reference,
            commonIdentifier: bodyPayload.commonIdentifier
              ? slugify(bodyPayload.commonIdentifier.toLowerCase())
              : provider.commonIdentifier,
            name: bodyPayload.name ?? provider.name,
            paymentType: bodyPayload.paymentType ?? provider.paymentType,
            logoUrl:
              bodyPayload.logoUrl !== null
                ? bodyPayload.logoUrl ?? provider.logoUrl
                : null, // the null value is used to remove the logo URL
            updatedAt: new Date(),
            updatedById: user.id,
          },
        });

        return Response.json(provider);
      } else {
        return Response.json(
          {
            message: "Mode de paiement introuvable.",
          },
          { status: 404 },
        );
      }
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
