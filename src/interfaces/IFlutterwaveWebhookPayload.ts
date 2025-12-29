export default interface IFlutterwaveWebhookPayload {
  event: string;
  data: Data;
}

export interface Data {
  id: number;
  tx_ref: string;
  flw_ref: string;
  device_fingerprint: string;
  amount: number;
  currency: string;
  charged_amount: number;
  app_fee: number;
  merchant_fee: number;
  processor_response: string;
  auth_model: string;
  ip: string;
  narration: string;
  status: string;
  payment_type: string;
  created_at: string;
  account_id: number;
  customer: Customer;
  card: Card;
}

export interface Customer {
  id: number;
  name: string;
  phone_number: any;
  email: string;
  created_at: string;
}

export interface Card {
  first_6digits: string;
  last_4digits: string;
  issuer: string;
  country: string;
  type: string;
  expiry: string;
}
