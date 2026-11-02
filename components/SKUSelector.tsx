"use client";

import type { ProductSku } from "@/types/catalogResponseType";

export interface SKUSelectorProps {
  skus: ProductSku[];
  selectedSkuId: string | undefined;
  onChange: (skuId: string) => void;
}

export function SKUSelector({
  skus,
  selectedSkuId,
  onChange,
}: SKUSelectorProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Choose an option</legend>
      <div className="flex min-w-0 flex-wrap gap-2">
        {skus.map((sku) => {
          const label =
            [sku.color, sku.size].filter(Boolean).join(" / ") || sku.skuCode;
          const selected = sku.id === selectedSkuId;
          return (
            <button
              key={sku.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(sku.id)}
              className={`min-h-11 min-w-11 max-w-full rounded-md border px-4 py-2 text-left text-sm transition-colors ${
                selected
                  ? "border-primary bg-orange-100 text-primary"
                  : "border-border bg-card hover:border-primary"
              }`}
            >
              <span className="block max-w-full [overflow-wrap:anywhere]">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default SKUSelector;
