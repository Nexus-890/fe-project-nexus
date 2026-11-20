"use client";

import { useEffect, useRef, useState } from "react";
import type { StockBalance } from "../types/backofficeType";

interface StockAdjustmentDialogProps {
  balance: StockBalance;
  warehouseName: string;
  pending: boolean;
  error?: string;
  onAdjust: (quantityDelta: number, reason: string) => void;
  onClose: () => void;
}

const inputClass = "mt-2 min-h-11 w-full rounded-sm border border-input bg-background px-3 text-sm";

function StockAdjustmentDialog({ balance, warehouseName, pending, error, onAdjust, onClose }: StockAdjustmentDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [direction, setDirection] = useState<"add" | "remove">("remove");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  const amount = /^\d+$/.test(quantity) ? Number(quantity) : NaN;
  const delta = direction === "add" ? amount : -amount;
  const tooMuch = direction === "remove" && amount > balance.available;
  const valid = Number.isInteger(amount) && amount >= 1 && amount <= 1_000_000 && !tooMuch && Boolean(reason.trim());
  return <dialog ref={dialog} aria-labelledby="stock-adjust-title" onCancel={(event) => { if (pending) event.preventDefault(); }} onClose={onClose}
    className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-md border border-border bg-card p-0 text-card-foreground shadow-modal backdrop:bg-foreground/40">
    <form onSubmit={(event) => { event.preventDefault(); if (!pending && valid) onAdjust(delta, reason.trim()); }}>
      <div className="p-6">
        <h2 id="stock-adjust-title" className="text-heading-20">Adjust stock</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Correct the on-hand count in {warehouseName} after a count, damage or loss. Reserved stock does not change; new deliveries go through stock intake.</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-sm bg-muted/50 p-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">On hand</dt><dd className="mt-1 font-mono">{balance.total}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Available</dt><dd className="mt-1 font-mono">{balance.available}</dd></div>
        </dl>
        <fieldset disabled={pending} className="mt-5 space-y-4">
          <legend className="sr-only">Adjustment</legend>
          <div role="radiogroup" aria-label="Direction" className="grid grid-cols-2 gap-2">
            {(["remove", "add"] as const).map((value) => <label key={value} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-sm border px-3 text-sm focus-within:ring-2 focus-within:ring-ring ${direction === value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
              <input type="radio" name="stock-adjust-direction" value={value} checked={direction === value} onChange={() => setDirection(value)} className="sr-only" />
              {value === "remove" ? "Remove stock" : "Add stock"}
            </label>)}
          </div>
          <label className="block text-sm font-medium">Quantity<input aria-label="Adjustment quantity" required inputMode="numeric" type="number" step="1" min="1" max={direction === "remove" ? Math.max(balance.available, 1) : 1_000_000} value={quantity} onChange={(event) => setQuantity(event.target.value)} className={inputClass} /></label>
          {tooMuch && <p role="alert" className="text-sm text-danger">Only {balance.available} available units can be removed.</p>}
          <label className="block text-sm font-medium">Reason<textarea aria-label="Adjustment reason" required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Cycle count found 2 damaged units" className="mt-2 min-h-24 w-full rounded-sm border border-input bg-background p-3 text-sm" /></label>
          <p className="text-xs text-muted-foreground">The reason is saved in the movement ledger.</p>
        </fieldset>
        {error && <p role="alert" className="mt-3 break-words text-sm text-danger">{error}</p>}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/40 p-4">
        <button type="button" disabled={pending} onClick={onClose} className="min-h-11 rounded-sm border border-border px-4 text-sm hover:bg-secondary disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={pending || !valid} className="min-h-11 rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">{pending ? "Saving…" : "Save adjustment"}</button>
      </div>
    </form>
  </dialog>;
}

export default StockAdjustmentDialog;
