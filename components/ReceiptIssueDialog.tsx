"use client";

import { useEffect, useRef, useState } from "react";

interface ReceiptIssueDialogProps {
  pending: boolean;
  error?: string;
  onReport: (reason: string) => void;
  onClose: () => void;
}

function ReceiptIssueDialog({ pending, error, onReport, onClose }: ReceiptIssueDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} aria-labelledby="receipt-issue-title" onCancel={(event) => { if (pending) event.preventDefault(); }} onClose={onClose}
    className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-md border border-border bg-card p-0 text-card-foreground shadow-modal backdrop:bg-foreground/40">
    <form onSubmit={(event) => { event.preventDefault(); if (!pending && reason.trim()) onReport(reason); }}>
      <div className="p-6">
        <h2 id="receipt-issue-title" className="text-heading-20">Report a problem</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Tell us what is missing or damaged. Reporting pauses completion of this order until the issue is resolved.</p>
        <label htmlFor="receipt-issue-reason" className="mt-5 block text-sm font-medium">What went wrong?</label>
        <textarea id="receipt-issue-reason" autoFocus required maxLength={500} value={reason} disabled={pending} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-28 w-full rounded-sm border border-input bg-background p-3 text-sm" />
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/40 p-4">
        <button type="button" disabled={pending} onClick={onClose} className="min-h-11 rounded-sm border border-border px-4 text-sm hover:bg-secondary disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={pending || !reason.trim()} className="min-h-11 rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">{pending ? "Reporting…" : "Submit problem"}</button>
      </div>
    </form>
  </dialog>;
}

export default ReceiptIssueDialog;
