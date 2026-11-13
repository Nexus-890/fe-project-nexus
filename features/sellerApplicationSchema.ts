import { z } from "zod";

export const sellerApplicationSchema = z.object({
  shopName: z.string().trim().min(2, "Shop name must have at least 2 characters.").max(150, "Shop name must have at most 150 characters."),
  description: z.string().trim().min(10, "Tell us about your shop in at least 10 characters.").max(1000, "Shop description must have at most 1,000 characters."),
});

export type SellerApplicationFormValues = z.infer<typeof sellerApplicationSchema>;
