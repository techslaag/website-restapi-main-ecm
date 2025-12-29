import { Currency } from "@prisma/client";

export default interface IPaymentReceipt {
  shipping: Shipping;
  items: Item[];
  subtotal: number;
  paid: number;
  receiptNumber: string;
  date: Date;
  currency: Currency;
}

export interface Shipping {
  name: string;
  email: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: number;
}

export interface Item {
  item: string;
  description: string;
  quantity: number;
  amount: number;
}
