import { Currency } from "@prisma/client";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export function formatStripeAmountIn(amount: number, currency: Currency) {
  let cents = 100;
  switch (currency) {
    case "xaf":
    case "xof":
      cents = 1;
      break;
  }

  return Number(amount / cents);
}

export function formatStripeAmountOut(amount: number, currency: Currency) {
  let cents = 100;
  switch (currency) {
    case "xaf":
    case "xof":
      cents = 1;
      break;
  }

  return Number(amount * cents);
}

export default stripe;
