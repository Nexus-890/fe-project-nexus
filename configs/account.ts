/** Opt in only when the configured backend contains the pinned #210 contract. */
export const ACCOUNT_EXTENSIONS_ENABLED = process.env.NEXT_PUBLIC_ACCOUNT_EXTENSIONS_ENABLED === "true";
/** Requires #210 to implement the proposed own-read and complete application DTO. */
export const SELLER_APPLICATION_ENABLED = process.env.NEXT_PUBLIC_SELLER_APPLICATION_ENABLED === "true";
