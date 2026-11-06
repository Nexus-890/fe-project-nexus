import type { components } from "./userGeneratedType";
export type RegisterRequest = components["schemas"]["Register"];
export type SignUpRequest = RegisterRequest;
import type { components as gatewayComponents } from "./gatewayGeneratedType";
export type SessionRequest = gatewayComponents["schemas"]["SessionRequest"];
