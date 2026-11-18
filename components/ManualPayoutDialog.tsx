"use client";

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { sellerButton, sellerPrimary } from "./SellerUi";

type Props = {
  title: string;
  description: ReactNode;
  submitLabel: string;
  pending: boolean;
  error?: string;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
  danger?: boolean;
};

function ManualPayoutDialog({ title, description, submitLabel, pending, error, onSubmit, onClose, children, danger = false }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const id = useId();
  useEffect(() => {
    opener.current = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus(); };
  }, []);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!pending) onSubmit(); };
  return <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-help`} onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}
    className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-md border border-border bg-card p-0 text-card-foreground shadow-modal backdrop:bg-foreground/40">
    <form onSubmit={submit} noValidate>
      <div className="p-6">
        <h2 id={`${id}-title`} className="text-heading-20">{title}</h2>
        <div id={`${id}-help`} className="mt-3 text-sm leading-6 text-muted-foreground">{description}</div>
        <div className="mt-5 grid gap-4">{children}</div>
        {error && <p role="alert" className="mt-4 break-words text-sm text-danger">{error}</p>}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/40 p-4">
        <button type="button" className={sellerButton} disabled={pending} onClick={onClose}>Cancel</button>
        <button type="submit" className={danger ? `${sellerPrimary} border-danger bg-danger` : sellerPrimary} disabled={pending}>{pending ? "Sending…" : submitLabel}</button>
      </div>
    </form>
  </dialog>;
}

export default ManualPayoutDialog;
