import type { UserGender } from "../auth/response/type";

/** Matches user-service UpdateProfileRequest. Null/omitted values retain existing data. */
export interface UpdateProfileRequest {
  fullName?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: UserGender | null;
  address?: string | null;
}
