/** Opt in only when the configured backend contains the pinned #210 contract. */
export const ACCOUNT_EXTENSIONS_ENABLED = process.env.NEXT_PUBLIC_ACCOUNT_EXTENSIONS_ENABLED === "true";
/** Seller application operations are specified by the issue but not implemented on #210 yet. */
export const SELLER_APPLICATION_ENABLED = process.env.NEXT_PUBLIC_SELLER_APPLICATION_ENABLED === "true";
