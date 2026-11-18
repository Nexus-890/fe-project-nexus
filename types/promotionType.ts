import type { components } from "./commerceGeneratedType";

type Schemas = components["schemas"];
export type PromotionEvent = Schemas["Event"];
export type EventWrite = Schemas["EventWrite"];
export type EventRegistration = Schemas["EventRegistration"];
export type VoucherWrite = Schemas["VoucherWrite"];
export type ManagedVoucher = Schemas["ManagedVoucher"];
export type PublicVoucher = Schemas["PublicVoucher"];
export type WalletEntry = Schemas["VoucherWalletEntry"];
export type VoucherUsage = Schemas["VoucherUsage"];
export type VoucherQuote = Schemas["VoucherQuote"];
export type OrderVoucher = Schemas["OrderVoucher"];
