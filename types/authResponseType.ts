import type { components } from "./userGeneratedType";
export type LoginResponse = components["schemas"]["LoginResult"];
export type UserResponse = components["schemas"]["User"];
export type UserGender = NonNullable<UserResponse["gender"]>;
export type SignInResponse = LoginResponse;
export type RegisterResponse = UserResponse;
export type SignUpResponse = RegisterResponse;
