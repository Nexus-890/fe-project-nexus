/** Mô hình UI: sellerId được ánh xạ từ userId của API hồ sơ seller. */
export type SellerProfile = {
  sellerId: string;
  companyName: string;
  contactPhone: string;
  status: "PENDING" | "ACTIVE" | "REJECTED";
};
export type SellerProfileInput = Pick<SellerProfile, "companyName" | "contactPhone">;
