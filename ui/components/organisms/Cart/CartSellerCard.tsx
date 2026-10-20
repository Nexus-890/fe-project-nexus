/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { Minus, Package, Plus, Store } from "lucide-react";
import { formatVND } from "@/lib/format-price";
import type { CartItem } from "@/types/cart/response/type";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card";

interface CartSellerCardProps {
  sellerName: string;
  items: CartItem[];
  disabled: boolean;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
}

export default function CartSellerCard({ sellerName, items, disabled, onUpdateQuantity, onRemove }: CartSellerCardProps) {
  return (
    <Card className="gap-0 rounded-sm py-0 shadow-none">
      <CardHeader className="py-4 sm:py-5">
        <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Store size={16} className="shrink-0 text-gray-900" aria-hidden="true" />
          <span className="break-words">{sellerName}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border border-t border-border">
          {items.map((item) => (
            <li key={item.id} className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] items-start gap-x-4 gap-y-3 py-5 sm:grid-cols-[96px_minmax(0,1fr)_132px] xl:grid-cols-[96px_minmax(0,1fr)_132px_110px]">
              <Link href={`/products/${encodeURIComponent(item.productId)}?id=${encodeURIComponent(item.productId)}`} className="row-span-2 flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted sm:row-span-1 sm:size-24">
                {item.imageUrl ? <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-contain" /> : <Package className="size-7 text-gray-600" role="img" aria-label={`${item.productName} image unavailable`} />}
              </Link>
              <div className="min-w-0 space-y-1">
                <Link href={`/products/${encodeURIComponent(item.productId)}?id=${encodeURIComponent(item.productId)}`} className="inline-block break-words text-sm font-medium leading-5 hover:text-primary">{item.productName}</Link>
                {[item.color, item.size, item.sellerName ? `Sold by ${item.sellerName}` : null].filter(Boolean).length > 0 ? <p className="break-words text-xs leading-5 text-gray-900">{[item.color, item.size, item.sellerName ? `Sold by ${item.sellerName}` : null].filter(Boolean).join(" · ")}</p> : null}
                <div className="flex flex-wrap items-center gap-x-4">
                  <button type="button" aria-label={`Remove ${item.productName}`} disabled={disabled} onClick={() => onRemove(item.id)} className="inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 text-[13px] leading-5 font-normal text-[#ff0000] underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-5">Remove</button>
                </div>
              </div>
              <div className="col-start-2 flex min-h-11 w-fit items-center self-start overflow-hidden rounded-sm border border-border sm:col-start-auto" aria-label={`Quantity for ${item.productName}`}>
                <button type="button" aria-label={`Decrease quantity for ${item.productName}`} disabled={disabled || item.quantity <= 1} onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="inline-flex min-h-11 min-w-11 items-center justify-center hover:bg-muted disabled:cursor-not-allowed disabled:text-gray-500">
                  <Minus size={16} aria-hidden="true" />
                </button>
                <span className="inline-flex min-h-11 min-w-10 items-center justify-center border-x border-border px-2 text-sm tabular-nums">{item.quantity}</span>
                <button type="button" aria-label={`Increase quantity for ${item.productName}`} disabled={disabled} onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} className="inline-flex min-h-11 min-w-11 items-center justify-center hover:bg-muted disabled:cursor-not-allowed disabled:text-gray-500">
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>
              <p className="col-start-2 text-sm font-semibold text-primary tabular-nums sm:col-span-2 sm:col-start-2 xl:col-span-1 xl:col-start-auto xl:pt-2 xl:text-right" aria-label={`Line total for ${item.productName}`}>{formatVND(item.lineTotal) ?? "Price unavailable"}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
