"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./button";
import { adminInputClass } from "./AdminPrimitives";
import type { SellerApplication } from "../types/sellerApplicationType";
import type { SellerApplicationDecision } from "../types/adminSellerApplicationType";
import type { ApiError } from "../types/commonResponseType";

type SellerApplicationDecisionDialogProps = {
  application: SellerApplication;
  decision: SellerApplicationDecision;
  pending: boolean;
  error: ApiError | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
};

function SellerApplicationDecisionDialog({ application, decision, pending, error, onConfirm, onClose }: SellerApplicationDecisionDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const rejecting = decision === "reject";
  const valid = !rejecting || reason.trim().length > 0;
  useEffect(() => { dialog.current?.showModal(); }, []);

  return <dialog ref={dialog} aria-labelledby="seller-decision-title" aria-describedby="seller-decision-description"
    onCancel={(event) => { if (pending) event.preventDefault(); }} onClose={onClose}
    className="m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-md border border-border bg-card p-0 text-card-foreground shadow-modal backdrop:bg-foreground/40">
    <form onSubmit={(event) => { event.preventDefault(); if (!pending && valid) onConfirm(reason.trim()); }}>
      <div className="space-y-5 p-6">
        <div><h2 id="seller-decision-title" className="text-heading-20">{rejecting ? "Reject application?" : "Approve application?"}</h2>
          <p id="seller-decision-description" className="mt-2 text-sm leading-6 text-muted-foreground">{rejecting ? "The buyer will see your reason and can update their application." : "The buyer will gain seller access after signing in again."}</p></div>
        <dl className="space-y-3 rounded-sm bg-muted p-4 text-sm"><div><dt className="text-xs text-muted-foreground">Company</dt><dd className="mt-1 break-words font-medium">{application.companyName}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Contact phone</dt><dd className="mt-1 font-mono">{application.phone}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Application note</dt><dd className="mt-1 whitespace-pre-wrap break-words">{application.note}</dd></div></dl>
        {rejecting && <label className="grid gap-2 text-sm font-medium">Rejection reason (required)<textarea autoFocus required maxLength={1000} disabled={pending} value={reason} onChange={(event) => setReason(event.target.value)} className={`${adminInputClass} min-h-28 py-3 font-normal`} placeholder="Explain what the buyer needs to change" /></label>}
        {error && error.kind !== "aborted" && <p role="alert" className="text-sm text-danger">{error.status === 409 ? "This application has already been reviewed. Close this dialog to see its current status in the refreshed list." : error.detail || error.title}</p>}
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-border bg-muted/50 p-4">
        <Button type="button" variant="outline" className="min-h-10 rounded-sm px-4" disabled={pending} onClick={onClose}>Cancel</Button>
        <Button type="submit" variant={rejecting ? "destructive" : "default"} className="min-h-10 rounded-sm px-4" disabled={pending || !valid || error?.status === 409}>{pending ? "Saving decision…" : rejecting ? "Confirm rejection" : "Confirm approval"}</Button>
      </div>
    </form>
  </dialog>;
}

export default SellerApplicationDecisionDialog;
