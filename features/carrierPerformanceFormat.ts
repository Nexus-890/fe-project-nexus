import { MAX_PERFORMANCE_DAYS } from "../service/supportOperationsService";
import { sellerSalesDates } from "./sellerSalesFilters";

export const performancePercent = (value: number | null) => value === null ? "No data" : `${(value * 100).toFixed(1)}%`;
export const performanceHours = (value: number | null) => value === null ? "No data" : value >= 48 ? `${(value / 24).toFixed(1)} days` : `${value.toFixed(1)} h`;
export function performancePeriod(from: string, to: string): { from: string; to: string } | null {
  const range = sellerSalesDates(from, to);
  if (!range?.from || !range.to || Date.parse(range.to) - Date.parse(range.from) > MAX_PERFORMANCE_DAYS * 86_400_000) return null;
  return { from: range.from, to: range.to };
}
