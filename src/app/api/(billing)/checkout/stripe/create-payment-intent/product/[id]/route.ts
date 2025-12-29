import IProduct from "@/interfaces/IProduct";
import IPaymentIntentMetaData from "@/interfaces/IPaymentIntentMetaData";
import { parseProduct } from "@/lib/DataParsers";
import authMiddleware from "@/lib/auth/authMiddleware";
import prisma from "@/lib/prisma";
import stripe, { formatStripeAmountOut } from "@/lib/stripe/stripe";
import { syncStripeWebhooks } from "@/lib/stripe/stripeWebhookSync";
import { errorResponse } from "@/lib/utils/index";
import { PurchaseEntityType } from "@prisma/client";
import { serializeError } from "serialize-error";

/**
 * @swagger
 * /purchase/{id}:
 *   post:
 *     summary: Créer un PaymentIntent pour l'achat d'un produit
 *     description: Cette route permet de créer un PaymentIntent pour acheter un produit spécifique, en utilisant Stripe pour effectuer le paiement.
 *     operationId: createPaymentIntentForProductPurchase
 *     tags:
 *       - Achat
 *     parameters:
 *       - name: id
 *         in: path
 *         description: L'ID du produit à acheter.
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       description: Les informations nécessaires pour procéder à l'achat (aucun corps de requête spécifique).
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Montant de l'achat à effectuer (calculé selon le produit).
 *               currency:
 *                 type: string
 *                 description: Devise utilisée pour le paiement (ici EUR).
 *               clientSecret:
 *                 type: string
 *                 description: Client secret pour finaliser le paiement via Stripe.
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
 *                   description: Montant total à payer.
 *                 clientSecret:
 *                   type: string
 *                   description: Client secret pour finaliser le paiement.
 *                 currency:
 *                   type: string
 *                   description: Devise utilisée (EUR).
 *       '400':
 *         description: L'utilisateur a déjà acheté ce produit.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message d'erreur expliquant que l'achat a déjà été effectué.
 *       '404':
 *         description: Le produit spécifié n'est pas trouvé.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message d'erreur expliquant que le produit n'existe pas.
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

function evaluatePostPrice(post: IProduct) {
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
        const product = parseProduct(rawPost);

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
            { message: "Vous avez déjà acheté ce produit." },
            { status: 400 },
          );
        } else {
          // get the order price
          const orderAmount = evaluatePostPrice(product);

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
              product: "product",
              productId: product.id.toString(),
              entityType: ((): PurchaseEntityType => {
                switch (product.productType) {
                  case "bihebdomadaire":
                    return "biweekly";

                  case "hors-serie":
                    return "special_issues";

                  case "magazine":
                    return "magazine";
                }
              })(),
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
          { message: "Le product est introuvable." },
          { status: 404 },
        );
      }
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
