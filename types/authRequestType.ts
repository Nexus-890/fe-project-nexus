import type { components } from "./userGeneratedType";
export type RegisterRequest = components["schemas"]["Register"];
export type LoginRequest = components["schemas"]["Login"];
export type SignUpRequest = RegisterRequest;
export type SignInRequest = LoginRequest;
