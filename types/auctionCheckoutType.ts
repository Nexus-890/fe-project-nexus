/**
 * Normalized application model for #172's shipping confirmation contract.
 * Verified against commerce AuctionShippingController/AuctionShippingService and
 * OpenAPI on integration branch b17f3275; that branch is not yet on develop.
 * Money is numeric on the wire and exact decimal strings in this UI model.
 */
export type AuctionShippingConfirmation = {
  orderGroupId: string;
  shippingFee: string;
  totalAmount: string;
  dueAt: string;
};
