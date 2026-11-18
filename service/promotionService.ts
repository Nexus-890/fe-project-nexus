import { z } from "zod";
import { createInvalidResponseError, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { PageInfo } from "../types/commonResponseType";
import type { EventRegistration, EventWrite, ManagedVoucher, OrderVoucher, PromotionEvent, PublicVoucher, VoucherQuote, VoucherUsage, VoucherWrite, WalletEntry } from "../types/promotionType";

const id = z.uuid();
const date = z.iso.datetime({ offset: true });
const money = z.number().finite().nonnegative().refine((n) => Number.isSafeInteger(Math.round(n * 100)), "Amount exceeds safe precision");
const source = z.enum(["PLATFORM", "EVENT", "SHOP"]);
const nullableText = z.string().nullable().optional();
const eventSchema = z.object({ id, name: z.string().min(1), description: nullableText, bannerUrl: nullableText,
  registrationStartAt: date, registrationEndAt: date, startAt: date, endAt: date,
  status: z.enum(["DRAFT", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ACTIVE", "ENDED", "CANCELED"]),
  registrationOpenRequested: z.boolean(), createdAt: date, updatedAt: date });
const publicSchema = z.object({ id, code: z.string().min(1), name: z.string().min(1), description: nullableText, sourceType: source,
  eventId: id.nullable().optional(), ownerSellerId: id.nullable().optional(), discountType: z.enum(["FIXED", "PERCENT"]),
  discountValue: money, maxDiscountAmount: money.nullable().optional(), minOrderAmount: money.nullable().optional(),
  productScope: z.enum(["ALL", "SELECTED"]), claimStartAt: date, claimEndAt: date, validFrom: date, validUntil: date, termsText: nullableText });
const voucherSchema = publicSchema.extend({ fundingType: z.enum(["PLATFORM", "SELLER", "CO_FUNDED"]),
  sellerFundingPercent: money.max(100).nullable().optional(), claimLimit: z.number().int().positive().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(), discountBudget: money.nullable().optional(),
  termsVersion: z.number().int().positive(), status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "EXPIRED", "CANCELED"]),
  claimCount: z.number().int().nonnegative(), committedUses: z.number().int().nonnegative(), committedDiscount: money, createdAt: date, updatedAt: date });
const managedSchema = z.object({ voucher: voucherSchema, productIds: z.array(id) });
const walletSchema = z.object({ id, status: z.enum(["CLAIMED", "USED", "EXPIRED"]), claimedAt: date, expiresAt: date, voucher: publicSchema });
const registrationSchema = z.object({ id, eventId: id, sellerId: id, status: z.enum(["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"]), registeredAt: date,
  reviewedBy: id.nullable().optional(), reviewedAt: date.nullable().optional(), reviewNote: nullableText, withdrawnAt: date.nullable().optional() });
const usageSchema = z.object({ id, orderId: id, status: z.enum(["RESERVED", "REDEEMED", "RELEASED", "EXPIRED", "REVERSED"]),
  eligibleAmount: money, discountAmount: money, sellerFunded: money, platformFunded: money, reservedAt: date, reservedUntil: date,
  redeemedAt: date.nullable().optional(), releasedAt: date.nullable().optional() });
const quoteSchema = z.object({ code: z.string(), sourceType: source.nullable().optional(), applied: z.boolean(), discountAmount: money,
  reason: z.enum(["MIN_ORDER_NOT_MET", "NOT_CLAIMED", "EXPIRED", "LIMIT_REACHED", "NOT_ELIGIBLE", "STACKING"]).nullable().optional(), missingAmount: money.nullable().optional() });
const orderVoucherSchema = z.object({ code: z.string().min(1), discountAmount: money, sellerFunded: money, platformFunded: money });
const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw createInvalidResponseError("Invalid promotions response");
  return result.data;
};
export const parseVoucherQuotes = (value: unknown): VoucherQuote[] => parse(z.array(quoteSchema), value);
export const parseOrderVouchers = (value: unknown): OrderVoucher[] => parse(z.array(orderVoucherSchema), value);
export type PromotionPage<T> = { content: T[]; page: PageInfo };
export type PromotionFilters = { page?: number; size?: number; status?: string; sourceType?: string; eventId?: string; productId?: string; sellerId?: string };
const pageRead = async <T>(path: string, schema: z.ZodType<T>, filters: PromotionFilters, options: ServiceRequestOptions, publicRead = false): Promise<PromotionPage<T>> => {
  const response = await requestApi("GET", path, undefined, { ...options, auth: !publicRead, params: { page: 0, size: 10, ...filters } });
  if (!response.page) throw createInvalidResponseError("Missing promotions page metadata");
  return { content: parse(z.array(schema), response.data), page: response.page };
};
const ref = (value: string) => encodeURIComponent(parse(id, value));
const events = "/api/v1/promotions/events";
const vouchers = "/api/v1/vouchers";
export const getPromotionEvents = async (filters: PromotionFilters = {}, options: ServiceRequestOptions = {}): Promise<PromotionPage<PromotionEvent>> => pageRead(events, eventSchema, filters, options);
export const savePromotionEvent = async (eventId: string | undefined, input: EventWrite, options: ServiceRequestOptions = {}): Promise<PromotionEvent> => {
  const { data } = await requestApi(eventId ? "PUT" : "POST", eventId ? `${events}/${ref(eventId)}` : events, input, { ...options, auth: true });
  return parse(eventSchema, data);
};
export const changeEventStatus = async (eventId: string, status: "OPEN" | "CANCEL", options: ServiceRequestOptions = {}): Promise<PromotionEvent> => {
  const { data } = await requestApi("PATCH", `${events}/${ref(eventId)}/status`, { status }, { ...options, auth: true });
  return parse(eventSchema, data);
};
export const getEventRegistrations = async (eventId: string, filters: PromotionFilters = {}, options: ServiceRequestOptions = {}): Promise<PromotionPage<EventRegistration>> => pageRead(`${events}/${ref(eventId)}/sellers`, registrationSchema, filters, options);
export const reviewEventRegistration = async (registrationId: string, status: "APPROVED" | "REJECTED", reviewNote: string, options: ServiceRequestOptions = {}): Promise<EventRegistration> => {
  const { data } = await requestApi("PATCH", `/api/v1/promotions/event-sellers/${ref(registrationId)}`, { status, reviewNote }, { ...options, auth: true });
  return parse(registrationSchema, data);
};
export const registerForEvent = async (eventId: string, options: ServiceRequestOptions = {}): Promise<EventRegistration> => {
  const { data } = await requestApi("POST", `${events}/${ref(eventId)}/registrations`, undefined, { ...options, auth: true });
  return parse(registrationSchema, data);
};
export const withdrawFromEvent = async (eventId: string, options: ServiceRequestOptions = {}): Promise<void> => { await requestApi("DELETE", `${events}/${ref(eventId)}/registrations/me`, undefined, { ...options, auth: true }); };
export const getManagedVouchers = async (filters: PromotionFilters = {}, options: ServiceRequestOptions = {}): Promise<PromotionPage<ManagedVoucher>> => pageRead(`${vouchers}/manage`, managedSchema, filters, options);
export const getManagedVoucher = async (voucherId: string, options: ServiceRequestOptions = {}): Promise<ManagedVoucher> => {
  const { data } = await requestApi("GET", `${vouchers}/${ref(voucherId)}`, undefined, { ...options, auth: true });
  return parse(managedSchema, data);
};
export const saveVoucher = async (voucherId: string | undefined, input: VoucherWrite, options: ServiceRequestOptions = {}): Promise<ManagedVoucher> => {
  const { data } = await requestApi(voucherId ? "PUT" : "POST", voucherId ? `${vouchers}/${ref(voucherId)}` : vouchers, input, { ...options, auth: true });
  return parse(managedSchema, data);
};
export const changeVoucherStatus = async (voucherId: string, status: "ACTIVE" | "PAUSED" | "CANCELED", options: ServiceRequestOptions = {}): Promise<ManagedVoucher> => {
  const { data } = await requestApi("PATCH", `${vouchers}/${ref(voucherId)}/status`, { status }, { ...options, auth: true });
  return parse(managedSchema, data);
};
export const setVoucherProducts = async (voucherId: string, productIds: string[], options: ServiceRequestOptions = {}): Promise<ManagedVoucher> => {
  const { data } = await requestApi("PUT", `${vouchers}/${ref(voucherId)}/products`, { productIds: parse(z.array(id).max(500), productIds) }, { ...options, auth: true });
  return parse(managedSchema, data);
};
export const getVoucherUsages = async (voucherId: string, filters: PromotionFilters = {}, options: ServiceRequestOptions = {}): Promise<PromotionPage<VoucherUsage>> => pageRead(`${vouchers}/${ref(voucherId)}/usages`, usageSchema, filters, options);
export const joinEventVoucher = async (voucherId: string, acceptedTermsVersion: number, options: ServiceRequestOptions = {}) => {
  const { data } = await requestApi("POST", `${vouchers}/${ref(voucherId)}/sellers`, { acceptedTermsVersion }, { ...options, auth: true });
  return parse(z.object({ id, voucherId: id, eventSellerId: id, status: z.enum(["ACTIVE", "WITHDRAWN"]), acceptedTermsVersion: z.number().int().positive(),
    acceptedTermsSnapshot: nullableText, sellerFundingPercentSnapshot: money, acceptedAt: date, withdrawnAt: date.nullable().optional() }), data);
};
export const withdrawEventVoucher = async (voucherId: string, options: ServiceRequestOptions = {}): Promise<void> => { await requestApi("DELETE", `${vouchers}/${ref(voucherId)}/sellers/me`, undefined, { ...options, auth: true }); };
export const getClaimableVouchers = async (filters: PromotionFilters = {}, options: ServiceRequestOptions = {}): Promise<PromotionPage<PublicVoucher>> => pageRead(vouchers, publicSchema, filters, options, true);
export const getVoucherWallet = async (filters: PromotionFilters = {}, options: ServiceRequestOptions = {}): Promise<PromotionPage<WalletEntry>> => pageRead(`${vouchers}/me`, walletSchema, filters, options);
export const claimVoucher = async (voucherId: string, options: ServiceRequestOptions = {}): Promise<WalletEntry> => {
  const { data } = await requestApi("POST", `${vouchers}/${ref(voucherId)}/claim`, undefined, { ...options, auth: true });
  return parse(walletSchema, data);
};
export const getVoucherPricing = async (voucherCodes: string[], options: ServiceRequestOptions = {}) => {
  // Spring MVC binds repeated query parameters. Preserve an explicit empty list to clear cart fallback.
  const query = voucherCodes.length ? voucherCodes.map((code) => `voucherCodes=${encodeURIComponent(code)}`).join("&") : "voucherCodes=";
  const { data } = await requestApi("GET", `/api/v1/carts/me/pricing?${query}`, undefined, { ...options, auth: true });
  return parse(z.object({ subtotal: money, taxAmount: money, discountAmount: money, estimatedShippingFee: money.nullable(), total: money, vouchers: z.array(quoteSchema) }), data);
};

/** Each unselected offer is evaluated against the actual selection, independently. */
export const getVoucherEligibility = async (selected: string[], candidates: string[], options: ServiceRequestOptions = {}): Promise<VoucherQuote[]> => {
  const current = await getVoucherPricing(selected, options);
  return Promise.all(candidates.map(async (code) => {
    const result = selected.includes(code) ? current : await getVoucherPricing([...selected, code], options);
    const quote = result.vouchers.find((row) => row.code === code);
    if (!quote) throw createInvalidResponseError("Missing voucher eligibility result");
    return quote;
  }));
};
