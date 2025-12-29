import IPaymentIntentMetaData from "@/interfaces/IPaymentIntentMetaData";
import IPaymentReceipt from "@/interfaces/IPaymentReceipt";
import prisma from "@/lib/prisma";
import { generateSubscriptionReference } from "@/lib/referenceFactory";
import { Payment, Prisma, PurchaseEntityType, User } from "@prisma/client";
import moment from "moment";
import Mail from "nodemailer/lib/mailer";
import slugify from "slugify";
import { sanitizeEmail } from ".";
import { sendEmail } from "../mail";
import buildPaymentFailedEmail from "../mail/emails/buildPaymentFailedEmail";
import buildPurchaseReceiptEmail from "../mail/emails/buildPurchaseReceiptEmail";
import buildSubscriptionSuccessEmail from "../mail/emails/buildSubscriptionSuccessEmail";
import generatePaymentReceipt from "../payment-receipt/generatePaymentReceipt";
import { fetchPurchaseRelatedProduct } from "./purchaseUtils";

export const PAYMENT_PUBLIC_SELECT_INPUT = {
  id: true,
  provider: true,
  providerPaymentMethod: true,
  mobileOperator: true,
  clientCountryAlpha2Code: true,
  reference: true,
  paidAmount: true,
  status: true,
  paidAmountCurrency: true,
  createdAt: true,
} as const satisfies Prisma.PaymentSelect;

export async function applyPaymentResult(payment: Payment & { user: User }) {
  console.log("[applyPaymentResult] ========== PROCESSING PAYMENT ==========");
  console.log("[applyPaymentResult] Payment ID:", payment.id);
  console.log("[applyPaymentResult] Payment Status:", payment.status);
  console.log("[applyPaymentResult] User:", payment.user.email);
  console.log("[applyPaymentResult] Meta:", payment.meta);

  // success payment
  if (payment.status === "succeeded") {
    // extract meta data
    const meta = JSON.parse(payment.meta as string) as IPaymentIntentMetaData;
    console.log("[applyPaymentResult] Parsed Meta:", JSON.stringify(meta, null, 2));
    console.log("[applyPaymentResult] Product type:", meta.product);

    switch (meta.product) {
      case "subscription":
        {
          console.log("[applyPaymentResult] ========== CREATING SUBSCRIPTION ==========");
          console.log("[applyPaymentResult] Plan ID:", meta.planId);
          console.log("[applyPaymentResult] Period:", meta.period);
          console.log("[applyPaymentResult] User ID:", meta.userId);

          const currentDate = moment();

          // payment already traited
          const subscriptionCount = await prisma.subscription.count({
            where: {
              paymentId: payment.id,
            },
          });

          console.log("[applyPaymentResult] Existing subscriptions for this payment:", subscriptionCount);

          if (subscriptionCount === 0) {
            console.log("[applyPaymentResult] Creating new subscription...");
            // load subscription
            const subscription = await prisma.subscription.create({
              data: {
                reference: await generateSubscriptionReference(),
                planId: meta.planId,
                period: meta.period,
                userId: meta.userId,
                paymentId: payment.id,
                expiresAt: (() => {
                  switch (meta.period) {
                    case "month":
                      return currentDate.add(1, "month").toDate();

                    case "year":
                      return currentDate.add(1, "year").toDate();
                  }
                })(),
                updatedAt: new Date(),
                updatedById: meta.userId,
              },
              include: {
                user: true,
                plan: true,
                payment: true,
              },
            });

            console.log("[applyPaymentResult] ========== SUBSCRIPTION CREATED ==========");
            console.log("[applyPaymentResult] Subscription ID:", subscription.id);
            console.log("[applyPaymentResult] Subscription Reference:", subscription.reference);
            console.log("[applyPaymentResult] Plan:", subscription.plan.title, "-", subscription.plan.planType);
            console.log("[applyPaymentResult] Period:", subscription.period);
            console.log("[applyPaymentResult] Expires At:", subscription.expiresAt);
            console.log("[applyPaymentResult] User:", subscription.user.email);

            /**
             * User notification
             * ------------------------------
             * Send the email with the receipt as attachment
             */

            // attachments
            const mailAttachments: Mail.Attachment[] = [];

            if (subscription.payment) {
              // create the receipt input
              const receipt: IPaymentReceipt = {
                currency: subscription.payment.paidAmountCurrency,
                receiptNumber: subscription.payment.reference,
                items: [
                  {
                    amount: subscription.payment.paidAmount.toNumber(),
                    description: `Abonnement ${subscription.plan.title} ${(() => {
                      switch (subscription.period) {
                        case "month":
                          return "(M)";

                        case "year":
                          return "(A)";
                      }
                    })()}`,
                    item: subscription.reference,
                    quantity: 1,
                  },
                ],
                paid: subscription.payment.paidAmount.toNumber(),
                shipping: {
                  email: sanitizeEmail(subscription.user.email) ?? "",
                  name: subscription.user.name ?? "",
                },
                subtotal: subscription.payment.paidAmount.toNumber(),
                date: subscription.createdAt,
              };

              // generate the receipt
              const receiptBuffer = await generatePaymentReceipt(receipt);

              // generate the file name
              const receiptFileName = slugify(
                `receipt-${subscription.plan.title}-${subscription.payment.reference.replaceAll(".", "-")}.pdf`.toLowerCase(),
              );

              mailAttachments.push({
                filename: receiptFileName,
                content: receiptBuffer,
                contentDisposition: "attachment",
                contentType: "application/pdf",
              });
            }

            // generate verification emails
            const email = await buildSubscriptionSuccessEmail(subscription);

            // send email
            await sendEmail(
              {
                to: subscription.user.email!,
                subject: `Abonnement ${subscription.plan.title} activé`,
                html: email.emailHtml,
                text: email.emailText,
                attachments: mailAttachments,
              },
              (err, info) => {
                if (err) {
                  // failed to send the verification email
                  // error needs to be reported
                } else {
                  // the email has been successfully sent.
                }
              },
            );
          }
        }
        break;

      case "post":
      case "product":
        {
          // purchase count
          const purchaseCount = await prisma.purchase.count({
            where: { paymentId: payment.id },
          });

          // payment not already used
          if (purchaseCount === 0) {
            const entityId = (() => {
              switch (meta.product) {
                case "post":
                  return Number(meta.postId);

                case "product":
                  return Number(meta.productId);
              }
            })();

            const entityType = ((): PurchaseEntityType => {
              switch (meta.product) {
                case "post":
                  return "post";

                case "product":
                  return meta.entityType;
              }
            })();

            // create the post purchase
            const purchase = await prisma.purchase.create({
              data: {
                entityType,
                paymentId: payment.id,
                postId: entityId,
                userId: meta.userId,
                updatedAt: new Date(),
                updatedById: meta.userId,
              },
              include: {
                payment: true,
                user: true,
              },
            });

            const productData = await fetchPurchaseRelatedProduct(
              purchase.entityType,
              purchase.postId.toString(),
            );

            /**
             * User notification
             * ------------------------------
             * Send the email with the receipt as attachment
             */

            // attachments
            const mailAttachments: Mail.Attachment[] = [];

            // create the receipt input
            const receipt: IPaymentReceipt = {
              currency: purchase.payment.paidAmountCurrency,
              receiptNumber: purchase.payment.reference,
              items: [
                {
                  amount: purchase.payment.paidAmount.toNumber(),
                  item: purchase.payment.reference,
                  description: productData.data
                    ? `${productData.data.title}`
                    : productData.details.label,
                  quantity: 1,
                },
              ],
              paid: purchase.payment.paidAmount.toNumber(),
              shipping: {
                email: sanitizeEmail(purchase.user.email) ?? "",
                name: purchase.user.name ?? "",
              },
              subtotal: purchase.payment.paidAmount.toNumber(),
              date: purchase.createdAt,
            };

            // generate the receipt
            const receiptBuffer = await generatePaymentReceipt(receipt);

            // generate the file name
            const receiptFileName = slugify(
              `receipt-${purchase.entityType}-${purchase.payment.reference.replaceAll(".", "-")}.pdf`.toLowerCase(),
            );

            mailAttachments.push({
              filename: receiptFileName,
              content: receiptBuffer,
              contentDisposition: "attachment",
              contentType: "application/pdf",
            });

            // generate verification emails
            const email = await buildPurchaseReceiptEmail(purchase);

            // send email
            await sendEmail(
              {
                to: purchase.user.email!,
                cc: process.env.EMAIL_ADMIN_ECOMATIN,
                subject: email.emailSubject,
                html: email.emailHtml,
                text: email.emailText,
                attachments: mailAttachments,
              },
              (err, info) => {
                if (err) {
                  // failed to send the verification email
                  // error needs to be reported
                } else {
                  // the email has been successfully sent.
                }
              },
            );

            await sendEmail(
              {
                to: 'christiankamga025@gmail.com', 
                subject: email.emailSubject,
                html: email.emailHtml,
                text: email.emailText,
                attachments: mailAttachments,
              },
              (err, info) => {
                if (err) {
                  // failed to send the verification email
                  // error needs to be reported
                } else {
                  // the email has been successfully sent.
                }
              },
            );

            await sendEmail(
              {
                to: process.env.EMAIL_ADMIN_ECOMATIN,
                subject: email.emailSubject,
                html: email.emailHtml,
                text: email.emailText,
                attachments: mailAttachments,
              },
              (err, info) => {
                if (err) {
                  // failed to send the verification email
                  // error needs to be reported
                } else {
                  // the email has been successfully sent.
                }
              },
            );
          }
        }
        break;

      default:
        break;
    }
  } else if (payment.status === "failed") {
    // generate verification emails
    const email = await buildPaymentFailedEmail(payment);

    // send email
    await sendEmail(
      {
        to: payment.user.email!,
        subject: email.emailSubject,
        html: email.emailHtml,
        text: email.emailText,
      },
      (err, info) => {
        if (err) {
          // failed to send the verification email
          // error needs to be reported
        } else {
          // the email has been successfully sent.
        }
      },
    );
  }
}
