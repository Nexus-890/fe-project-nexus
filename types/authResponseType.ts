import type { components } from "./userGeneratedType";
export type UserResponse = components["schemas"]["User"];
export type UserGender = NonNullable<UserResponse["gender"]>;
export type RegisterResponse = UserResponse;
export type SignUpResponse = RegisterResponse;
