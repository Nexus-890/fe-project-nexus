import { z } from "zod";
import type { UserResponse } from "../types/authResponseType";
import type { UpdateProfileRequest } from "../types/accountType";

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function todayLocal() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(150, "Full name must contain 1 to 150 characters"),
  email: z.string().trim().toLowerCase().min(1, "Email is required").max(255, "Email must contain 1 to 255 characters").email("Enter a valid email address"),
  phone: z.string(), // Read-only in the current backend UpdateProfileRequest.
  dateOfBirth: z.string().refine((value) => value === "" || validDate(value), "Enter a valid date")
    .refine((value) => value === "" || value <= todayLocal(), "Date of birth must not be in the future"),
  gender: z.enum(["", "MALE", "FEMALE", "OTHER"]),
  address: z.string().trim(),
  identityNumber: z.string().trim().max(255, "Identity number must contain at most 255 characters"),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export function profileFormValues(user: UserResponse): ProfileFormValues {
  return {
    fullName: user.fullName, email: user.email, phone: user.phone,
    dateOfBirth: user.dateOfBirth ?? "", gender: user.gender ?? "", address: user.address ?? "",
    identityNumber: "",
  };
}

export function profileUpdate(values: ProfileFormValues, edited: Partial<Record<keyof ProfileFormValues, boolean>>): UpdateProfileRequest {
  return {
    ...(edited.fullName ? { fullName: values.fullName } : {}),
    ...(edited.email ? { email: values.email } : {}),
    ...(edited.address ? { address: values.address } : {}),
    ...(edited.dateOfBirth && values.dateOfBirth ? { dateOfBirth: values.dateOfBirth } : {}),
    ...(edited.gender && values.gender ? { gender: values.gender } : {}),
    ...(edited.identityNumber && values.identityNumber ? { identityNumber: values.identityNumber } : {}),
  };
}
