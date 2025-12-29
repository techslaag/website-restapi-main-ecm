import prisma from "../prisma";
import stripe from "./stripe";

export function getStripeWebhookUrl() {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/checkout/stripe/webhook`;
}

export async function syncStripeWebhooks() {
  try {
    // make sure we create a stripe webhook
    await getStripeWebhook();
  } catch (error) {
    console.error("won't work locally");
  }
}

export async function getStripeWebhook() {
  // getting the webhook url
  const webhookUrl = getStripeWebhookUrl();

  // we assume that the list will not contains more than 100 values
  const webhookEndpoints = await stripe.webhookEndpoints.list({
    limit: 100,
  });

  // checking if the webhook exist remotely
  const remoteWh = webhookEndpoints.data.find(
    (item) => item.url === webhookUrl,
  );

  // webhook already created
  const localWh = await prisma.stripeWebhook.findFirst({
    where: {
      url: webhookUrl,
    },
  });

  // webhook exist locally
  if (localWh && remoteWh) {
    return localWh;
  } else {
    // the webhook exist on stripe side
    if (localWh) {
      // delete the webhook that doesn't exists locally
      await prisma.stripeWebhook.delete({
        where: {
          id: localWh.id,
        },
      });
    }

    // create the new webhook
    const wh = await stripe.webhookEndpoints.create({
      enabled_events: [
        "payment_intent.succeeded",
        "checkout.session.completed",
        "payment_intent.payment_failed",
      ],
      url: webhookUrl,
    });

    return await prisma.stripeWebhook.create({
      data: {
        events: wh.enabled_events.join(","),
        externalId: wh.id,
        liveMode: wh.livemode,
        secret: wh.secret!,
        url: wh.url,
      },
    });
  }
}
