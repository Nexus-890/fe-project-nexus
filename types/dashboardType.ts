import type { components } from "./commerceGeneratedType";
import type { OrderStatus } from "./orderResponseType";

export type OrderSummaryWireResponse = components["schemas"]["OrderSummary"];
export type OrderSummaryScope = "managed" | "sales";
export const dashboardRanges = [7, 30, 90] as const;
export type DashboardRange = typeof dashboardRanges[number];

export type OrderSummaryDay = {
  date: string;
  orderCount: number;
  paidOrderCount: number;
  revenue: string;
};

export type OrderSummaryReport = {
  from: string;
  to: string;
  timeZone: string;
  orderCount: number;
  paidOrderCount: number;
  revenue: string;
  statuses: { status: OrderStatus; count: number }[];
  profit?: { costOfGoods: string; grossProfit: string | null; coveredOrderCount: number; missingCostOrderCount: number };
  daily: OrderSummaryDay[];
};
