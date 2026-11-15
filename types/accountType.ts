import type { components } from "./userGeneratedType";
import type { components as accountComponents } from "./account210GeneratedType";

/** Editable profile fields from the delivered user-service contract. */
export type UpdateProfileRequest = components["schemas"]["UpdateProfile"] & Pick<accountComponents["schemas"]["UpdateProfile"], "phone">;
