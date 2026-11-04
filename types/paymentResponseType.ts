import type { components } from "./paymentGeneratedType";

export type PaymentWireResponse = components["schemas"]["PaymentInitResponse"];

/** Whole-VND display/copy model with a monotonic, server-derived deadline. */
export type PaymentInstructions = Omit<PaymentWireResponse, "amount"> & {
  amount: string;
  receivedAt: number;
  remainingMs: number;
};
