/** Issue #257 profile projection; delivered backend DTO is still pending. */
export type SellerProfile = {
  sellerId: string;
  companyName: string;
  contactPhone: string;
  status: "PENDING" | "ACTIVE" | "REJECTED";
};
export type SellerProfileInput = Pick<SellerProfile, "companyName" | "contactPhone">;
