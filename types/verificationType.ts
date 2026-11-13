/** Provisional frontend models for #210; these are not delivered user-service DTOs. */
export type PhoneVerification = { phone: string; verified: boolean };
export type VerificationDelivery = { retryAfterSeconds: number; expiresInSeconds: number };
