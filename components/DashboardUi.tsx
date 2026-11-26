"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CircleAlert } from "lucide-react";
import { formatVND } from "./formatPrice";
import { ORDER_STATUS_LABELS } from "./OrderStatusBadge";
import type { OrderSummaryDay, OrderSummaryReport } from "../types/dashboardType";

export const formatDashboardAmount = (amount: string): string => amount.startsWith("-")
  ? `−${formatVND(amount.slice(1).replace(/\.0+$/, "")) ?? amount.slice(1)}`
  : formatVND(amount.replace(/\.0+$/, "")) ?? amount;
export const formatDashboardDay = (date: string): string => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

export function DashboardStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="min-w-0 rounded-lg border border-border bg-card p-4">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-2 truncate text-2xl font-semibold tabular-nums">{value}</p>
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </div>;
}

export function DashboardQueue({ label, description, href, count, loading, failed }: {
  label: string; description: string; href: string; count: number | undefined; loading: boolean; failed: boolean;
}) {
  const value = failed ? "—" : loading || count === undefined ? "…" : count.toLocaleString("vi-VN");
  return <Link href={href} className="group flex min-h-24 min-w-0 flex-col justify-between rounded-lg border border-border bg-card p-4 outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring">
    <span className="flex items-start justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <span className={`text-2xl font-semibold tabular-nums ${count ? "text-foreground" : "text-muted-foreground"}`}>{value}</span>
    </span>
    <span className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">{failed && <CircleAlert aria-hidden="true" className="size-3 text-danger" />}{failed ? "Could not load this count" : description}</span>
      <ArrowRight aria-hidden="true" className="size-3 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </span>
  </Link>;
}

export function DailyRevenueChart({ days }: { days: OrderSummaryDay[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...days.map((day) => Number(day.revenue)));
  const shown = days[active ?? days.length - 1];
  const ticks = days.length > 1 ? [0, Math.floor((days.length - 1) / 2), days.length - 1] : [0];
  return <figure className="min-w-0">
    <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-sm font-medium">Daily revenue</span>
      {shown && <span aria-live="polite" className="text-xs text-muted-foreground tabular-nums">{formatDashboardDay(shown.date)} · {formatDashboardAmount(shown.revenue)} · {shown.paidOrderCount} paid of {shown.orderCount} orders</span>}
    </figcaption>
    <div className="mt-4 flex gap-2">
      <div aria-hidden="true" className="flex w-16 shrink-0 flex-col justify-between text-right text-[11px] text-muted-foreground tabular-nums">
        <span className="truncate">{max ? formatDashboardAmount(max.toFixed(2)) : ""}</span>
        <span>0</span>
      </div>
      <div className="min-w-0 flex-1">
        <div aria-hidden="true" className="relative flex h-40 items-end border-b border-border" onMouseLeave={() => setActive(null)}>
          {max === 0 && <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">No paid orders in this period</span>}
          {days.map((day, index) => {
            const height = max ? Math.max(Number(day.revenue) / max * 100, Number(day.revenue) > 0 ? 2 : 0) : 0;
            return <div key={day.date} className="flex h-full min-w-0 flex-1 items-end px-px" onMouseEnter={() => setActive(index)}>
              <div className={`w-full rounded-t-sm ${active === index ? "bg-primary-hover" : "bg-primary"}`} style={{ height: `${height}%` }} />
            </div>;
          })}
        </div>
        <div aria-hidden="true" className="relative mt-1 h-4 text-[11px] text-muted-foreground tabular-nums">
          {ticks.map((index) => <span key={index} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: `${days.length > 1 ? index / (days.length - 1) * 100 : 0}%` }}>{formatDashboardDay(days[index].date)}</span>)}
        </div>
      </div>
    </div>
    <table className="sr-only">
      <caption>Daily revenue and orders</caption>
      <thead><tr><th scope="col">Day</th><th scope="col">Orders</th><th scope="col">Paid orders</th><th scope="col">Revenue</th></tr></thead>
      <tbody>{days.map((day) => <tr key={day.date}><th scope="row">{day.date}</th><td>{day.orderCount}</td><td>{day.paidOrderCount}</td><td>{formatDashboardAmount(day.revenue)}</td></tr>)}</tbody>
    </table>
  </figure>;
}

export function OrderStatusBreakdown({ statuses }: { statuses: OrderSummaryReport["statuses"] }) {
  const max = Math.max(0, ...statuses.map((entry) => entry.count));
  return <div className="min-w-0">
    <h3 className="text-sm font-medium">Orders by status</h3>
    <dl className="mt-4 space-y-2">
      {statuses.map((entry) => <div key={entry.status} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-xs">
        <dt className="truncate text-muted-foreground">{ORDER_STATUS_LABELS[entry.status]}</dt>
        <div aria-hidden="true" className="h-2 rounded-sm bg-muted"><div className="h-2 rounded-sm bg-info" style={{ width: `${max ? entry.count / max * 100 : 0}%` }} /></div>
        <dd className="text-right font-medium tabular-nums">{entry.count.toLocaleString("vi-VN")}</dd>
      </div>)}
    </dl>
  </div>;
}
