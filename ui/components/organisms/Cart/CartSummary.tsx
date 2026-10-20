import { formatVND } from "@/lib/format-price";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card";

interface CartSummaryProps {
  count: number;
  subtotal: string;
}

export default function CartSummary({ count, subtotal }: CartSummaryProps) {
  return (
    <Card className="gap-4 rounded-sm shadow-none">
      <CardHeader><CardTitle>Order Summary</CardTitle></CardHeader>
      <CardContent>
        <dl className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <dt className="text-gray-900">Subtotal ({count} {count === 1 ? "item" : "items"})</dt>
          <dd className="font-semibold text-primary tabular-nums" aria-live="polite">{formatVND(subtotal) ?? "Price unavailable"}</dd>
        </dl>
        <div className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">Prices in VND</div>
      </CardContent>
    </Card>
  );
}
