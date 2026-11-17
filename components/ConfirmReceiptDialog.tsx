"use client";

import { useEffect, useRef } from "react";
import { PackageCheck } from "lucide-react";

interface ConfirmReceiptDialogProps {
  orderNumber: string;
  pending: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}

function ConfirmReceiptDialog({ orderNumber, pending, error, onConfirm, onClose }: ConfirmReceiptDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);

  return <dialog ref={dialog} aria-labelledby="confirm-receipt-title" aria-describedby="confirm-receipt-help"
    onCancel={(event) => { if (pending) event.preventDefault(); }} onClose={onClose}
    className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-md border border-border bg-card p-0 text-card-foreground shadow-modal backdrop:bg-foreground/40">
    <div className="p-6">
      <PackageCheck size={28} className="text-primary" aria-hidden="true" />
      <h2 id="confirm-receipt-title" className="mt-4 text-heading-20">Confirm you received your order</h2>
      <p id="confirm-receipt-help" className="mt-3 text-sm leading-6 text-muted-foreground">Have all items in order <span className="font-mono text-foreground [overflow-wrap:anywhere]">{orderNumber}</span> arrived in good condition? Confirming completes this order and lets you rate the seller.</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">If anything is missing or damaged, choose Not yet and report a problem to pause completion.</p>
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    </div>
    <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/40 p-4">
      <button type="button" autoFocus disabled={pending} onClick={onClose} className="min-h-11 rounded-sm border border-border bg-background px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50">Not yet</button>
      <button type="button" disabled={pending} onClick={onConfirm} className="min-h-11 rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">{pending ? "Confirming…" : "Confirm receipt"}</button>
    </div>
  </dialog>;
}

export default ConfirmReceiptDialog;
