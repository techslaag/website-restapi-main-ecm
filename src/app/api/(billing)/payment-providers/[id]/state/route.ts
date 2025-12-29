import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import { z } from "zod";

/**
 * @swagger
 * components:
 *   schemas:
 *     PaymentProviderUpdate:
 *       type: object
 *       properties:
 *         enable:
 *           type: boolean
 *           description: L'état du mode de paiement, où `true` signifie activé et `false` désactivé.
 *       required:
 *         - enable
 * /payment-provider/{id}:
 *   patch:
 *     summary: Met à jour l'état d'un fournisseur de paiement
 *     description: Cette route permet de mettre à jour l'état du mode de paiement d'un fournisseur, en l'activant ou en le désactivant.
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
 *       204:
 *         description: Mise à jour réussie, aucune donnée renvoyée.
 *       400:
 *         description: La requête est malformée ou les données fournies sont invalides.
 *       404:
 *         description: Le fournisseur de paiement avec l'ID spécifié n'a pas été trouvé.
 *       500:
 *         description: Une erreur serveur s'est produite lors du traitement de la demande.
 */

export const dynamic = "force-dynamic";

const schema = z.object({
  enable: z.boolean({
    required_error: "L'état du mode de paiement est requis.",
  }),
});

export async function PATCH(
  req: Request,
  { params: { id: providerId } }: { params: { id: string } },
) {
  return adminMiddleware(req, async (user) => {
    try {
      // load provider
      const provider = await prisma.paymentProvider.findUnique({
        where: { id: providerId },
      });

      // provider exists
      if (provider) {
        const bodyPayload = schema.parse(await requestJsonBody(req));

        // update the state
        await prisma.paymentProvider.update({
          where: { id: providerId },
          data: {
            updatedAt: new Date(),
            disabledAt: bodyPayload.enable ? null : new Date(),
            updatedById: user.id,
          },
        });

        return new Response(undefined, { status: 204 });
      } else {
        return Response.json(
          {
            message: "Offre introuvable.",
          },
          { status: 404 },
        );
      }
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
