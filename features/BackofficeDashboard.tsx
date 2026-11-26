"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "../components/button";
import { AdminError } from "../components/AdminPrimitives";
import { DailyRevenueChart, DashboardQueue, DashboardStat, formatDashboardAmount, OrderStatusBreakdown } from "../components/DashboardUi";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getSystemHealth } from "../service/adminObservabilityService";
import { getAdminSellerApplications } from "../service/adminSellerApplicationService";
import { getOrderSummary } from "../service/dashboardService";
import { getManualPayouts } from "../service/manualPayoutService";
import { getAdminPayouts } from "../service/payoutService";
import { getRatingDisputes } from "../service/ratingModerationService";
import { getSellerProducts, getSellerSales } from "../service/sellerService";
import { getManagedOrders } from "../service/supportOperationsService";
import type { DashboardRange, OrderSummaryScope } from "../types/dashboardType";
import { dashboardRanges } from "../types/dashboardType";
import { payoutNeedsActionStatuses } from "../types/payoutType";
import type { BackofficeRole } from "./backofficeAccess";

type Queue = { name: string; label: string; description: string; href: string; load: (signal: AbortSignal) => Promise<number> };

function QueueCount({ queue }: { queue: Queue }) {
  const auth = useAuth();
  const result = useApiQuery({
    queryKey: queryKeys.dashboard.queue(auth.sessionId, queue.name),
    service: queue.load,
    meta: { requiresAuth: true },
  }, { enabled: auth.status === "authenticated", refetchInterval: 60_000 });
  return <DashboardQueue label={queue.label} description={queue.description} href={queue.href}
    count={result.data} loading={result.isPending} failed={!!result.error && result.data === undefined} />;
}

function OrderOverview({ scope, title, description, queues }: { scope: OrderSummaryScope; title: string; description: string; queues: Queue[] }) {
  const auth = useAuth();
  const [days, setDays] = useState<DashboardRange>(30);
  const summary = useApiQuery({
    queryKey: queryKeys.dashboard.orders(auth.sessionId, scope, days),
    service: (signal) => getOrderSummary(scope, days, { context: auth.requestContext, signal }),
    meta: { requiresAuth: true },
  }, { enabled: auth.status === "authenticated", placeholderData: (previous) => previous });
  const report = summary.data;
  const average = report && report.paidOrderCount ? (Number(report.revenue) / report.paidOrderCount).toFixed(2) : "0.00";
  const headingId = `dashboard-${scope}`;
  return <section aria-labelledby={headingId} className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0"><h2 id={headingId} className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Period" className="inline-flex rounded-sm border border-border p-0.5">
          {dashboardRanges.map((range) => <button key={range} type="button" aria-pressed={days === range} onClick={() => setDays(range)}
            className={`min-h-9 rounded-sm px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${days === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{range} days</button>)}
        </div>
        <Button variant="outline" onClick={() => void summary.refetch()} disabled={summary.isFetching} aria-label="Refresh dashboard"><RefreshCw size={14} className={summary.isFetching ? "animate-spin" : ""} /></Button>
      </div>
    </div>
    {summary.error && <AdminError error={summary.error} onRetry={() => void summary.refetch()} />}
    {summary.isPending && <p role="status" className="text-sm text-muted-foreground">Loading order figures…</p>}
    {report && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStat label="Revenue" value={formatDashboardAmount(report.revenue)} hint="Paid, shipped, delivered and completed orders" />
        <DashboardStat label="Orders" value={report.orderCount.toLocaleString("vi-VN")} hint={`Last ${report.daily.length} days`} />
        <DashboardStat label="Paid orders" value={report.paidOrderCount.toLocaleString("vi-VN")} hint={report.orderCount ? `${Math.round(report.paidOrderCount / report.orderCount * 100)}% of orders` : "No orders yet"} />
        <DashboardStat label="Average paid order" value={formatDashboardAmount(average)} />
      </div>
      {scope === "sales" && report.profit && <div className="grid gap-3 sm:grid-cols-2">
        <DashboardStat label="Estimated gross profit" value={report.profit.grossProfit === null ? "Not enough cost data" : formatDashboardAmount(report.profit.grossProfit)}
          hint={report.profit.missingCostOrderCount > 0 ? `${report.profit.coveredOrderCount} orders included; ${report.profit.missingCostOrderCount} paid orders lack cost data` : "Goods revenue minus seller-funded discounts and recorded costs"} />
        <DashboardStat label="Cost of goods" value={formatDashboardAmount(report.profit.costOfGoods)}
          hint={`${report.profit.coveredOrderCount} of ${report.paidOrderCount} paid orders have complete costs`} />
        <p className="text-xs text-muted-foreground sm:col-span-2">Excludes shipping, tax, platform fees and operating expenses.</p>
      </div>}
      <div className="grid gap-6 rounded-lg border border-border bg-card p-4 lg:grid-cols-[2fr_1fr] sm:p-6">
        <DailyRevenueChart days={report.daily} />
        <OrderStatusBreakdown statuses={report.statuses} />
      </div>
      <p className="text-xs text-muted-foreground">Days follow {report.timeZone} time.</p>
    </>}
    {queues.length > 0 && <div>
      <h3 className="text-sm font-medium">Needs attention</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{queues.map((queue) => <QueueCount key={queue.name} queue={queue} />)}</div>
    </div>}
  </section>;
}

function BackofficeDashboard({ roles }: { roles: readonly BackofficeRole[] }) {
  const auth = useAuth();
  const options = (signal: AbortSignal) => ({ context: auth.requestContext, signal });
  const isAdmin = roles.includes("ADMIN");
  const isStaff = isAdmin || roles.includes("SUPPORT_STAFF");
  const staffQueues: Queue[] = isStaff ? [
    { name: "refund-requests", label: "Refund requests", description: "Orders waiting for a refund", href: "/backoffice/orders",
      load: async (signal) => (await getManagedOrders({ status: "REFUND_REQUESTED", size: 1 }, options(signal))).totalElements },
    { name: "manual-payout-review", label: "Manual payouts to review", description: "Manual transfers flagged for review", href: "/backoffice/manual-payouts",
      load: async (signal) => (await getManualPayouts({ needsReview: true, size: 1 }, options(signal))).totalElements },
    { name: "systems-down", label: "Systems unavailable", description: "Services and brokers reported down", href: "/backoffice/health",
      load: async (signal) => { const health = await getSystemHealth(options(signal)); return [...health.services, ...health.brokers].filter((item) => item.status === "DOWN").length; } },
    ...(isAdmin ? [
      { name: "seller-applications", label: "Seller applications", description: "Applications waiting for a decision", href: "/backoffice/seller-applications",
        load: async (signal: AbortSignal) => (await getAdminSellerApplications({ status: "PENDING", size: 1 }, options(signal))).page.totalElements },
      { name: "rating-disputes", label: "Rating disputes", description: "Disputes waiting for moderation", href: "/backoffice/rating-disputes",
        load: async (signal: AbortSignal) => (await getRatingDisputes("PENDING", 0, options(signal))).page.totalElements },
      { name: "payouts-action", label: "Payouts needing action", description: "On hold, unknown, failed or returned", href: "/backoffice/payouts",
        load: async (signal: AbortSignal) => (await getAdminPayouts({ status: payoutNeedsActionStatuses, size: 1 }, options(signal))).totalElements },
    ] : []),
  ] : [];
  const sellerQueues: Queue[] = roles.includes("SELLER") ? [
    { name: "seller-to-ship", label: "Orders to ship", description: "Paid orders waiting for fulfilment", href: "/backoffice/sales",
      load: async (signal) => (await getSellerSales(0, "PAID", options(signal))).totalElements },
    { name: "seller-refunds", label: "Refund requests", description: "Your orders waiting for a refund", href: "/backoffice/sales",
      load: async (signal) => (await getSellerSales(0, "REFUND_REQUESTED", options(signal))).totalElements },
    { name: "seller-drafts", label: "Draft products", description: "Products not published yet", href: "/backoffice/products",
      load: async (signal) => (await getSellerProducts(0, { status: "DRAFT" }, options(signal))).totalElements },
  ] : [];
  return <div className="space-y-10">
    {isStaff && <OrderOverview scope="managed" title={isAdmin ? "Marketplace overview" : "Support overview"}
      description="Orders and revenue across every seller, with queues that need a decision." queues={staffQueues} />}
    {roles.includes("SELLER") && <OrderOverview scope="sales" title="Your shop"
      description="Orders and revenue for your own products." queues={sellerQueues} />}
  </div>;
}

export default BackofficeDashboard;
