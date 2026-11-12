import { formatVND } from "./formatPrice";
import type { OrderPriceBreakdown as Breakdown } from "../types/orderResponseType";

const isZero = (amount: string) => Number(amount) === 0;

export function OrderPriceRows({ breakdown, compact = false }: { breakdown: Breakdown; compact?: boolean }) {
  const rows = [
    { id: "items", label: "Items subtotal", value: formatVND(breakdown.subtotal) },
    { id: "shipping", label: "Shipping fee", value: isZero(breakdown.shippingFee) ? "Free" : formatVND(breakdown.shippingFee) },
    ...(isZero(breakdown.discountAmount) ? [] : [{ id: "discount", label: "Discount", value: `− ${formatVND(breakdown.discountAmount)}` }]),
    ...(isZero(breakdown.taxAmount) ? [] : [{ id: "tax", label: "Tax", value: formatVND(breakdown.taxAmount) }]),
  ];
  return <>
    {rows.map((row, index) => <div key={row.id} data-testid={`order-breakdown-${row.id}`} className={`flex flex-wrap justify-between gap-x-5 gap-y-0.5${index === 0 && !compact ? " border-t border-border pt-4" : ""}`}>
      <dt className="text-muted-foreground">{row.label}</dt>
      <dd className="ml-auto min-w-0 text-right font-mono tabular-nums [overflow-wrap:anywhere]">{row.value}</dd>
    </div>)}
  </>;
}

export function OrderTotalPill({ total, breakdown, testId }: { total: string; breakdown: Breakdown | null; testId: string }) {
  if (!breakdown) return <span className="tabular-nums [overflow-wrap:anywhere]">{formatVND(total)}</span>;
  return <details data-testid={testId} className="group min-w-0">
    <summary className="inline-flex min-h-9 max-w-full cursor-pointer list-none items-center gap-1.5 rounded-full border border-border bg-muted px-3 text-sm font-medium tabular-nums hover:border-primary [&::-webkit-details-marker]:hidden">
      {formatVND(total)}
      <span aria-hidden="true" className="text-xs text-muted-foreground transition-transform group-open:rotate-180">▾</span>
      <span className="sr-only">Show price breakdown</span>
    </summary>
    <dl className="mt-2 min-w-0 space-y-1 rounded-sm border border-border bg-card p-3 text-xs font-normal">
      <OrderPriceRows breakdown={breakdown} compact />
      <div className="flex flex-wrap justify-between gap-x-5 gap-y-0.5 border-t border-border pt-1 font-semibold"><dt>Total</dt><dd className="ml-auto min-w-0 text-right font-mono tabular-nums [overflow-wrap:anywhere]">{formatVND(total)}</dd></div>
    </dl>
  </details>;
}
