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
 *     PaymentProvider:
 *       type: object
 *       required:
 *         - paymentType
 *         - currency
 *         - reference
 *         - commonIdentifier
 *         - name
 *         - countryAlpha2
 *         - countryAlpha3
 *       properties:
 *         id:
 *           type: string
 *           description: L'ID unique du fournisseur de paiement.
 *         paymentType:
 *           type: string
 *           enum: [card, digital_wallet, mobile]
 *           description: Le type de paiement utilisé par le fournisseur (carte, portefeuille numérique, mobile).
 *         currency:
 *           type: string
 *           enum: [xaf, xof, usd, eur]
 *           description: La devise du fournisseur (XAF, XOF, USD, EUR).
 *         reference:
 *           type: string
 *           description: La référence unique du fournisseur.
 *         commonIdentifier:
 *           type: string
 *           description: L'identifiant commun du fournisseur.
 *         logoUrl:
 *           type: string
 *           format: uri
 *           description: L'URL du logo du fournisseur de paiement (facultatif).
 *         name:
 *           type: string
 *           description: Le nom du fournisseur de paiement.
 *         countryAlpha2:
 *           type: string
 *           description: Le code alpha-2 du pays où le fournisseur opère.
 *         countryAlpha3:
 *           type: string
 *           description: Le code alpha-3 du pays où le fournisseur opère.
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Le message d'erreur retourné par le serveur.
 *         details:
 *           type: object
 *           description: Des détails supplémentaires sur l'erreur.
 * /payment-providers:
 *   post:
 *     summary: Créer un fournisseur de paiement
 *     description: Permet de créer un fournisseur de paiement avec les informations fournies dans la requête.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentProvider'
 *     responses:
 *       201:
 *         description: Le fournisseur de paiement a été créé avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentProvider'
 *       400:
 *         description: La requête contient des erreurs de validation des données.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Une erreur interne du serveur est survenue.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */


export const dynamic = "force-dynamic";

const schema = z.object({
  paymentType: z.enum([
    PaymentType.card,
    PaymentType.digital_wallet,
    PaymentType.mobile,
  ]),
  currency: z.enum([Currency.xaf, Currency.xof, Currency.usd, Currency.eur]),
  reference: z
    .string({ required_error: "La reférence est requise." })
    .min(5, "La reférence doit contenir au moins 5 caractères.")
    .max(100, "La valeur ne peut pas excéder 100 caractères."),
  commonIdentifier: z
    .string({ required_error: "L'identifiant commun est requis." })
    .min(2, "L'identifiant commun doit contenir au moins 2 caractères.")
    .max(100, "La valeur ne peut pas excéder 100 caractères."),
  logoUrl: z.string().url("L'adresse du logo n'est pas valide.").optional(),
  name: z
    .string()
    .min(5, "Le nom est requis.")
    .max(200, "La valeur ne peut pas excéder 200 caractères."),
  countryAlpha2: z
    .string()
    .min(2, "Le code alpha2 est requis.")
    .max(200, "La valeur ne peut pas excéder 200 caractères.")
    .length(2, "Le code alpha 2 du pays ne contient que 2 caractères."),
  countryAlpha3: z
    .string()
    .min(3, "Le code alpha2 est requis.")
    .max(200, "La valeur ne peut pas excéder 200 caractères.")
    .length(3, "Le code alpha 3 du pays ne contient que 2 caractères."),
});

export async function POST(req: Request) {
  return adminMiddleware(req, async (user) => {
    try {
      const bodyPayload = schema.parse(await requestJsonBody(req));

      const provider = await prisma.paymentProvider.create({
        data: {
          countryAlpha2: bodyPayload.countryAlpha2,
          countryAlpha3: bodyPayload.countryAlpha3,
          currency: bodyPayload.currency,
          commonIdentifier: slugify(bodyPayload.commonIdentifier.toLowerCase()),
          reference: slugify(bodyPayload.reference.toLowerCase()),
          name: bodyPayload.name,
          paymentType: bodyPayload.paymentType,
          logoUrl: bodyPayload.logoUrl,
          updatedAt: new Date(),
          updatedById: user.id,
        },
      });

      return Response.json(provider, { status: 201 });
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
