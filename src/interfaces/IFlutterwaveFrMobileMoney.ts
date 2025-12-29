export default interface IFlutterwaveFrMobileMoney {
  status: string;
  message: string;
  data: Data;
  meta: Meta;
}

export interface Data {
  id: number;
  tx_ref: string;
  flw_ref: string;
  device_fingerprint: string;
  amount: number;
  charged_amount: number;
  app_fee: number;
  merchant_fee: number;
  processor_response: string;
  auth_model: string;
  currency: string;
  ip: string;
  narration: string;
  status: "pending" | "successful";
  payment_type: string;
  fraud_status: string;
  charge_type: string;
  created_at: string;
  account_id: number;
  customer: Customer;
}

export interface Customer {
  id: number;
  phone_number: string;
  name: string;
  email: string;
  created_at: string;
}

export interface Meta {
  authorization: Authorization;
}

export interface Authorization {
  mode: string;
  redirect_url: any;
}
