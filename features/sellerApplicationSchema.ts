import { z } from "zod";

export const sellerApplicationSchema = z.object({
  companyName: z.string().trim().min(2, "Company name must have at least 2 characters.").max(150, "Company name must have at most 150 characters."),
  phone: z.string().trim().transform((value) => value.replace(/[\s()-]/g, "")).pipe(z.string().regex(/^\+?\d{7,15}$/, "Enter a valid contact phone number.")),
  note: z.string().trim().min(10, "Tell us about your business in at least 10 characters.").max(1000, "Application note must have at most 1,000 characters."),
});

export type SellerApplicationFormValues = z.infer<typeof sellerApplicationSchema>;
