import type { components } from "./userGeneratedType";
type UserWireResponse = components["schemas"]["User"];
/** Application model: the profile parser preserves absent verification metadata.
 * The generated wire DTO retains #210's required nullable field. */
export type UserResponse = Omit<UserWireResponse, "phoneVerifiedAt"> & Partial<Pick<UserWireResponse, "phoneVerifiedAt">>;
export type UserGender = NonNullable<UserResponse["gender"]>;
export type RegisterResponse = UserResponse;
export type SignUpResponse = RegisterResponse;
import type { components as gatewayComponents } from "./gatewayGeneratedType";
export type SessionResponse = gatewayComponents["schemas"]["Session"];
