import type { ApiError } from "../types/commonResponseType";

export function reputationRestrictionMessage(error: ApiError): string | null {
  if (error.code !== "AUCTION_REPUTATION_RESTRICTED" && error.code !== "CATALOG_REPUTATION_RESTRICTED") return null;
  const reason = error.extensions?.reason;
  const until = error.extensions?.restrictedUntil;
  const expiry = typeof until === "string" && Number.isFinite(Date.parse(until)) ? new Date(until).toLocaleString() : null;
  return `${typeof reason === "string" && reason.trim() ? reason : "Your account is temporarily restricted from this action."}${expiry ? ` Restricted until ${expiry}.` : ""}`;
}
