import type { SellerFulfilment } from "../types/sellerType";

export type FulfilmentStage = "none" | "paid" | "picked" | "packed";

export const fulfilmentStage = (steps: readonly SellerFulfilment[]): FulfilmentStage => {
  const paid = steps.filter((step) => step.status === "CONFIRMED");
  if (!paid.length) return "none";
  if (paid.every((step) => step.shippedAt)) return "packed";
  if (paid.every((step) => step.pickedAt)) return "picked";
  return "paid";
};
