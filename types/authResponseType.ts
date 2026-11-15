import type { components } from "./userGeneratedType";
import type { components as accountComponents } from "./account210GeneratedType";
/** #210 adds verification status; absence on develop is preserved. */
export type UserResponse = components["schemas"]["User"] & Partial<Pick<accountComponents["schemas"]["User"], "phoneVerifiedAt">>;
export type UserGender = NonNullable<UserResponse["gender"]>;
export type RegisterResponse = UserResponse;
export type SignUpResponse = RegisterResponse;
import type { components as gatewayComponents } from "./gatewayGeneratedType";
export type SessionResponse = gatewayComponents["schemas"]["Session"];
