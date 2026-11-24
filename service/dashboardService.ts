import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { normalizeMoney } from "./catalogService";
import { isOrderStatus, ORDER_STATUSES } from "./orderService";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { DashboardRange, OrderSummaryDay, OrderSummaryReport, OrderSummaryScope } from "../types/dashboardType";
import { dashboardRanges } from "../types/dashboardType";

const fail = (message: string): never => { throw createInvalidResponseError(message); };
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const instant = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
const money = (value: unknown): string => {
  const amount = typeof value === "number" && value >= 0 ? normalizeMoney(value) : null;
  return amount ?? fail("Invalid order summary amount");
};

const parseDay = (value: unknown): OrderSummaryDay => {
  if (!isRecord(value) || !date(value.date) || !count(value.orderCount) || !count(value.paidOrderCount) || value.paidOrderCount > value.orderCount)
    return fail("Invalid order summary day");
  return { date: value.date, orderCount: value.orderCount, paidOrderCount: value.paidOrderCount, revenue: money(value.revenue) };
};

export const parseOrderSummary = (value: unknown, days: number): OrderSummaryReport => {
  if (!isRecord(value) || !instant(value.from) || !instant(value.to) || typeof value.timeZone !== "string" || !value.timeZone ||
    !count(value.orderCount) || !count(value.paidOrderCount) || value.paidOrderCount > value.orderCount ||
    !Array.isArray(value.statuses) || !Array.isArray(value.daily))
    return fail("Invalid order summary");
  const statuses = value.statuses.map((entry) => {
    if (!isRecord(entry) || !isOrderStatus(entry.status) || !count(entry.count)) return fail("Invalid order summary status");
    return { status: entry.status, count: entry.count };
  });
  if (new Set(statuses.map((entry) => entry.status)).size !== ORDER_STATUSES.length || statuses.length !== ORDER_STATUSES.length)
    return fail("Order summary must list every order status once");
  const daily = value.daily.map(parseDay);
  if (daily.length !== days || daily.some((day, index) => index > 0 && day.date <= daily[index - 1].date))
    return fail("Order summary days do not match the requested window");
  if (statuses.reduce((sum, entry) => sum + entry.count, 0) !== value.orderCount ||
    daily.reduce((sum, day) => sum + day.orderCount, 0) !== value.orderCount)
    return fail("Order summary totals do not add up");
  return { from: value.from, to: value.to, timeZone: value.timeZone, orderCount: value.orderCount, paidOrderCount: value.paidOrderCount,
    revenue: money(value.revenue), statuses, daily };
};

export const getOrderSummary = async (scope: OrderSummaryScope, days: DashboardRange, options: ServiceRequestOptions = {}): Promise<OrderSummaryReport> => {
  if (!dashboardRanges.includes(days)) fail("Invalid dashboard range");
  const path = scope === "managed" ? "/api/v1/orders/manage/summary" : "/api/v1/orders/sales/summary";
  const { data } = await requestApi<unknown>("GET", path, undefined, { ...options, auth: true, params: { days } });
  return parseOrderSummary(data, days);
};
