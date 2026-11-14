/** Planned seller UI model. No controller/DTO or agreed response contract is delivered yet. */
export type SellerApplicationInput = {
  companyName: string;
  phone: string;
  note: string;
};

export type SellerApplication = SellerApplicationInput & {
  id: string;
  status: "PENDING" | "ACTIVE" | "REJECTED";
  rejectionReason: string | null;
};
