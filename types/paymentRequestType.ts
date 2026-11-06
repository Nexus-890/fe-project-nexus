import type { paths } from "./paymentGeneratedType";

export type InitiatePaymentRequest =
  paths["/api/v1/payments"]["post"]["requestBody"]["content"]["application/json"];
