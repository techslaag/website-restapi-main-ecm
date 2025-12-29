import IPaymentIntentMetaData from "@/interfaces/IPaymentIntentMetaData";
import { parsePackageFw } from "@/lib/DataParsers";
import authMiddleware from "@/lib/auth/authMiddleware";
import prisma from "@/lib/prisma";
import stripe, { formatStripeAmountOut } from "@/lib/stripe/stripe";
import { syncStripeWebhooks } from "@/lib/stripe/stripeWebhookSync";
import { errorResponse } from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import IPackage from "@/interfaces/IPackageFw";

/**
 * @swagger
 * /purchase/{id}:
 *   post:
 *     summary: Créer un PaymentIntent pour l'achat d'un package FW
 *     description: Cette route permet de créer un PaymentIntent pour l'achat d'un package FW, en utilisant Stripe, et empêche un utilisateur d'acheter le même package plusieurs fois.
 *     operationId: createPaymentIntentForPackageFw
 *     tags:
 *       - Paiement
 *     parameters:
 *       - name: id
 *         in: path
 *         description: L'ID du package à acheter.
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       description: Le corps de la requête ne nécessite pas de données supplémentaires.
 *       required: false
 *     responses:
 *       '200':
 *         description: PaymentIntent créé avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 amount:
 *                   type: number
 *                   description: Montant du package à payer.
 *                 clientSecret:
 *                   type: string
 *                   description: Client secret pour finaliser le paiement via Stripe.
 *                 currency:
 *                   type: string
 *                   description: Devise utilisée pour le paiement (EUR).
 *       '400':
 *         description: L'utilisateur a déjà acheté ce package ou une erreur est survenue.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Détail de l'erreur (par exemple, "Vous avez déjà acheté ce package FW").
 *       '404':
 *         description: Le package spécifié est introuvable.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Détail de l'erreur ("Le package est introuvable").
 *       '500':
 *         description: Une erreur interne s'est produite lors du traitement de la requête.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message détaillant l'erreur interne.
 */

export const dynamic = "force-dynamic";

function evaluatePostPrice(post: IPackage) {
  // the post must have a price
  let value: number = Number(post.price ?? 0);
  // we assume EUR
  let finalAmount: number = formatStripeAmountOut(value, "eur");

  return {
    value,
    finalAmount,
  };
}

export async function POST(
  req: Request,
  { params: { id } }: { params: { id: string } },
) {
  return authMiddleware(req, async (user) => {
    /**
     * Important: Sync stripe webhooks
     * ----------------------------------
     */
    syncStripeWebhooks();

    try {
      // load post
      const rawPost = await prisma.mod180_posts.findFirst({
        where: {
          OR: [
            { post_name: { equals: String(id) } },
            {
              ID: {
                equals: isNaN(Number(id)) ? -1 : Number(id),
              },
            },
          ],
        },
        select: {
          ID: true,
          post_name: true,
          post_title: true,
          post_date: true,
          post_excerpt: true,
          post_date_gmt: true,
          post_modified: true,
          post_modified_gmt: true,
          meta: {
            select: {
              meta_key: true,
              meta_value: true,
            },
          },
        },
      });

      // post exists
      if (rawPost) {
        // convert the post
        const packageFw = parsePackageFw(rawPost);

        /**
         * Prevent the user from buying the same entity twice
         * ----------------------------------------------------------
         */
        const purchase = await prisma.purchase.findFirst({
          where: {
            userId: user.id,
            postId: rawPost.ID,
            payment: {
              status: "succeeded",
            },
          },
        });

        // purchase already exists
        if (purchase) {
          return Response.json(
            { message: "Vous avez déjà acheté ce package FW." },
            { status: 400 },
          );
        } else {
          // get the order price
          const orderAmount = evaluatePostPrice(packageFw);

          // Create a PaymentIntent with the order amount and currency
          const paymentIntent = await stripe.paymentIntents.create({
            amount: orderAmount.finalAmount,
            currency: "eur",
            // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
            automatic_payment_methods: {
              enabled: true,
            },
            metadata: {
              userId: user.id,
              product: "packageFw",
              packageId: packageFw.id.toString(),
            } as IPaymentIntentMetaData,
          });

          return Response.json({
            amount: orderAmount.value,
            clientSecret: paymentIntent.client_secret,
            currency: "eur",
          });
        }
      } else {
        return Response.json(
          { message: "Le package est introuvable." },
          { status: 404 },
        );
      }
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
