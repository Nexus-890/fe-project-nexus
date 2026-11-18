"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}

function ConfirmDialog({ options, onAnswer }: { options: ConfirmOptions; onAnswer: (ok: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const answered = useRef(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const answer = (ok: boolean) => { if (answered.current) return; answered.current = true; dialog.current?.close(); onAnswer(ok); };
  return <dialog ref={dialog} aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message" onClose={() => answer(false)}
    className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-md border border-border bg-card p-0 text-card-foreground shadow-modal backdrop:bg-foreground/40">
    <div className="p-6">
      <h2 id="confirm-dialog-title" className="text-heading-20">{options.title}</h2>
      <div id="confirm-dialog-message" className="mt-3 text-sm leading-6 text-muted-foreground">{options.message}</div>
    </div>
    <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/40 p-4">
      <button type="button" autoFocus onClick={() => answer(false)} className="min-h-11 rounded-sm border border-border bg-background px-4 text-sm font-medium hover:bg-secondary">{options.cancelLabel ?? "Keep it"}</button>
      <button type="button" onClick={() => answer(true)} className={`min-h-11 rounded-sm px-4 text-sm font-medium ${options.destructive ? "bg-danger text-white hover:bg-danger/90" : "bg-primary text-primary-foreground hover:bg-primary-hover"}`}>{options.confirmLabel}</button>
    </div>
  </dialog>;
}

export function useConfirm() {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ options, resolve })), []);
  const dialog = pending ? <ConfirmDialog options={pending.options} onAnswer={(ok) => { pending.resolve(ok); setPending(null); }} /> : null;
  return { confirm, dialog };
}
