import type { components, operations } from "./sellerApplication210GeneratedType";
import type { SellerApplication } from "./sellerApplicationType";
import type { PageInfo } from "./commonResponseType";

/** Proposed #210 admin contract, separate from delivered user-service DTOs. */
export type AdminSellerApplicationFilters = NonNullable<operations["listSellerApplications"]["parameters"]["query"]>;
export type RejectSellerApplicationInput = components["schemas"]["RejectSellerApplicationInput"];
export type AdminSellerApplicationPage = { applications: SellerApplication[]; page: PageInfo };
export type SellerApplicationDecision = "approve" | "reject";
