/** Application models for the provisional #210 seller contract; no wire DTO is delivered yet. */
export type SellerApplicationInput = {
  shopName: string;
  description: string;
};

export type SellerApplication = SellerApplicationInput & {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  submittedAt: string;
};
