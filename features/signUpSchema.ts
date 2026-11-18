import { z } from "zod";

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required"),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .email("Enter a valid email address"),
    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required")
      .regex(/^[+\d][\d\s()-]{6,19}$/, "Enter a valid phone number"),
    identityNumber: z.string().trim().min(1, "Identity number is required"),
    gender: z.enum(["MALE", "FEMALE", "OTHER"], {
      error: "Gender is required",
    }),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    address: z.string().trim().min(1, "Choose a province and ward, then enter your house number and street"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[0-9]/, "Password must contain a number")
      .regex(/[^A-Za-z0-9]/, "Password must contain a symbol"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    termsAccepted: z
      .boolean()
      .refine(
        Boolean,
        "You must accept the Terms of Service and Privacy Policy",
      ),
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export type SignUpFormValues = z.infer<typeof signUpSchema>;
