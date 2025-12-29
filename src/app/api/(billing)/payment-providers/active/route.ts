import IPaginateResponse from "@/interfaces/IPaginateResponse";
import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils/index";
import { PaymentProvider, Prisma } from "@prisma/client";

/**
 * @swagger
 * components:
 *   schemas:
 *     PaymentProvider:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: L'ID unique du fournisseur de paiement.
 *         paymentType:
 *           type: string
 *           enum: [card, digital_wallet, mobile]
 *           description: Le type de paiement du fournisseur.
 *         reference:
 *           type: string
 *           description: La référence unique du fournisseur de paiement.
 *         commonIdentifier:
 *           type: string
 *           description: L'identifiant commun du fournisseur de paiement.
 *         name:
 *           type: string
 *           description: Le nom du fournisseur de paiement.
 *         currency:
 *           type: string
 *           enum: [xaf, xof, usd, eur]
 *           description: La devise du fournisseur de paiement.
 *         countryAlpha2:
 *           type: string
 *           description: Le code alpha-2 du pays du fournisseur de paiement.
 *         countryAlpha3:
 *           type: string
 *           description: Le code alpha-3 du pays du fournisseur de paiement.
 *         logoUrl:
 *           type: string
 *           format: uri
 *           description: L'URL du logo du fournisseur de paiement.
 *     PaginateResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PaymentProvider'
 *         totalCount:
 *           type: integer
 *           description: Le nombre total de fournisseurs de paiement disponibles.
 * /payment-providers:
 *   get:
 *     summary: Récupère la liste des fournisseurs de paiement activés
 *     description: Récupère une liste paginée de tous les fournisseurs de paiement dont l'état est activé (disabledAt est null).
 *     responses:
 *       200:
 *         description: Liste des fournisseurs de paiement récupérée avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginateResponse'
 *       500:
 *         description: Erreur interne du serveur.
 */


export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const whereQuery: Prisma.PaymentProviderWhereInput = {
    disabledAt: null, // exclude disabled provider
  };

  const providers = await prisma.paymentProvider.findMany({
    where: whereQuery,
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      paymentType: true,
      reference: true,
      commonIdentifier: true,
      name: true,
      currency: true,
      countryAlpha2: true,
      countryAlpha3: true,
      logoUrl: true,
    },
  });

  return Response.json(
    toSafeJSON<IPaginateResponse<PaymentProvider>>(providers),
  );
}
