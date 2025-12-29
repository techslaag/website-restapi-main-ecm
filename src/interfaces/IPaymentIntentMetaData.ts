import { PurchaseEntityType } from "@prisma/client";

type IPaymentIntentMetaData =
  | {
      userId: string;
      product: "subscription";
      planId: string;
      period: "month" | "year";
    }
  | {
      userId: string;
      product: "post";
      postId: string;
    }
  | {
      userId: string;
      product: "product";
      productId: string;
      entityType: Exclude<PurchaseEntityType, "post" & "packagefw">;
    }
  | {
      userId: string;
      product: "packageFw";
      packageId: string;
    }
    | {
      userId: string;
      product: "documentaire";
      packageId: string;
    };

export default IPaymentIntentMetaData;
