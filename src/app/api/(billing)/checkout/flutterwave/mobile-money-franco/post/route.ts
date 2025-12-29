import IPost, { toIPost } from "@/interfaces/IPost";
import authMiddleware from "@/lib/auth/authMiddleware";
import { syncFlutterwaveCronJob } from "@/lib/flutterwave/syncCronJob";
import countryAndExchangeRatesMiddleware from "@/lib/middlewares/countryAndExchangeRatesMiddleware";
import prisma from "@/lib/prisma";
import { createMobileMoneyFrancoPayment } from "@/lib/utils/flutterwaveUtils";
import {
  convertAmountToClientCurrency,
  requestJsonBody,
  roundToNext100,
} from "@/lib/utils/index";
import { POST_SELECT_INPUT } from "@/lib/utils/postUtils";
import { serializeError } from "serialize-error";
import { z } from "zod";

/**
 * @swagger
 * /post/payment:
 *   post:
 *     summary: Créer un paiement pour un article via Mobile Money
 *     description: Cette route permet à un utilisateur de créer un paiement pour un article en utilisant son numéro de téléphone et la devise du pays.
 *     operationId: postPaymentForPost
 *     tags:
 *       - MobileMoney
 *     requestBody:
 *       description: Données nécessaires pour effectuer un paiement pour l'achat d'un article.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userIp:
 *                 type: string
 *                 description: L'adresse IP de l'utilisateur.
 *               postId:
 *                 type: string
 *                 description: L'ID de l'article à acheter.
 *               phoneNumber:
 *                 type: string
 *                 description: Le numéro de téléphone pour le paiement via Mobile Money.
 *             required:
 *               - userIp
 *               - postId
 *               - phoneNumber
 *     responses:
 *       '201':
 *         description: Le paiement a été effectué avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 payment:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       description: Le statut du paiement.
 *                     transactionId:
 *                       type: string
 *                       description: Identifiant unique de la transaction.
 *       '400':
 *         description: La requête contient des erreurs, comme un article introuvable ou un mode de paiement non supporté.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message détaillant l'erreur (ex. "Article introuvable" ou "Mode de paiement non supporté").
 *       '500':
 *         description: Erreur interne du serveur.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message d'erreur détaillé.
 */


export const dynamic = "force-dynamic";

const schema = z.object({
  userIp: z.string({
    required_error: "L'adresse ip de l'utilisateur est requise.",
  }),
  postId: z.string({
    required_error: "L'identifiant de l'article est obligatoire.",
  }),
  phoneNumber: z.string({
    required_error: "Le numéro de téléphone est obligatoire.",
  }),
});

function evaluatePostPrice(post: IPost) {
  // the post must have a price
  let value: number = Number(post.price ?? 0);
  return {
    value,
    currency: post.currency ?? "EUR",
  };
}

export async function POST(request: Request) {
  return authMiddleware(request, async (user) => {
    try {
      /**
       * Sync cron job url
       * ----------------------------
       */
      await syncFlutterwaveCronJob();

      // validate the body
      const bodyPayload = schema.parse(await requestJsonBody(request));

      return await countryAndExchangeRatesMiddleware(
        bodyPayload.userIp,
        "eur",
        async (ipData, exchangeRates) => {
          // already own the post
          const purchase = await prisma.purchase.findFirst({
            where: {
              userId: user.id,
              postId: Number(bodyPayload.postId),
              payment: { status: "succeeded" },
            },
          });

          if (purchase) {
            return Response.json(
              {
                message:
                  "Vous avez déjà acheté cet article. Merci de consulter vos achats.",
              },
              {
                status: 400,
              },
            );
          } else {
            // check supported currency
            if (["xaf", "xof"].includes(ipData.currencyCode.toLowerCase())) {
              // fetch the post
              const postData = await prisma.mod180_posts.findUnique({
                where: { ID: Number(bodyPayload.postId) },
                select: POST_SELECT_INPUT,
              });

              // post exists
              if (postData) {
                // convert post
                const post = toIPost(postData);

                const baseAmount = evaluatePostPrice(post);

                // converted amount
                const amount = convertAmountToClientCurrency(
                  ipData,
                  exchangeRates,
                  baseAmount.value,
                  baseAmount.currency,
                );

                // adjusted amount
                const finalAmount = roundToNext100(amount.amount);

                // process the payment
                const result = await createMobileMoneyFrancoPayment(
                  ipData,
                  user,
                  "post",
                  bodyPayload.phoneNumber,
                  {
                    currency: amount.currency,
                    value: finalAmount,
                  },
                  {
                    userId: user.id,
                    product: "post",
                    postId: post.id,
                  },
                );

                if (result.success) {
                  return Response.json(result.data?.payment, {
                    status: 201,
                  });
                } else {
                  return Response.json(result.error, {
                    status: 400,
                  });
                }
              } else {
                return Response.json(
                  { message: "L'article est introuvable." },
                  { status: 400 },
                );
              }
            } else {
              return Response.json(
                {
                  message:
                    "Ce mode de paiement n'est pas supporté dans votre pays.",
                },
                { status: 400 },
              );
            }
          }
        },
      );
    } catch (error) {
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}
