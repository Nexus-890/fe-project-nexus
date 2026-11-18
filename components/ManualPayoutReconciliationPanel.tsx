"use client";

import { useState } from "react";
import ManualPayoutDialog from "./ManualPayoutDialog";
import { sellerButton, sellerInput } from "./SellerUi";
import { parseResolutionForm, parseRetryForm, parseReviewForm, resolutionNeedsProof } from "../features/manualPayoutSchema";
import type { DisputeReviewInput, ManualPayoutDetail, ManualResolutionInput } from "../types/manualPayoutType";

type Dialog = "resolve" | "review" | "retry" | null;
type Props = {
  payout: ManualPayoutDetail;
  canReconcile: boolean;
  pending: boolean;
  error?: string;
  resolve: (input: ManualResolutionInput) => void;
  review: (input: DisputeReviewInput) => void;
  retry: (input: { reason: string }) => void;
  dialog: Dialog;
  setDialog: (dialog: Dialog) => void;
};

const outcomeLabels: Record<string, string> = {
  CONFIRMED_SENT: "Bank app shows the transfer was sent",
  CONFIRMED_NOT_SENT: "Bank app shows no transfer was sent",
  CONFIRMED_RETURNED: "The bank returned the transfer",
  CONFIRMATION_RECORDED_IN_ERROR: "Staff recorded Completed without a transfer (correction)",
};
const outcomesFor = (payout: ManualPayoutDetail) => payout.attempt?.state === "UNKNOWN" ? ["CONFIRMED_SENT", "CONFIRMED_NOT_SENT"] :
  payout.attempt?.state === "SUCCEEDED" ? ["CONFIRMED_RETURNED", ...(payout.hasOpenDispute ? ["CONFIRMATION_RECORDED_IN_ERROR"] : [])] : [];

function ManualPayoutReconciliationPanel({ payout, canReconcile, pending, error, resolve, review, retry, dialog, setDialog }: Props) {
  const [outcome, setOutcome] = useState("");
  const [reason, setReason] = useState("");
  const [proof, setProof] = useState<string[]>([]);
  const [decision, setDecision] = useState("");
  const [localError, setLocalError] = useState("");
  const has = (action: string) => payout.allowedActions.some((entry) => entry === action);
  const open = (next: Dialog) => { setLocalError(""); setReason(""); setProof([]); setOutcome(""); setDecision(""); setDialog(next); };
  const evidence = payout.attempt?.evidence ?? [];
  const reviewNeeded = payout.needsReview || payout.hasOpenDispute || ["FAILED", "RETURNED"].includes(payout.status);
  if (!reviewNeeded && !has("RESOLVE") && !has("REVIEW_DISPUTE") && !has("RETRY")) return null;
  return <section aria-label="Reconciliation" className="mt-6 rounded-sm border border-warning/30 bg-warning/5 p-4">
    <h3 className="text-sm font-semibold">Reconciliation</h3>
    {payout.dispute && <div className="mt-3 text-sm"><p>Seller case <span className="font-mono text-xs">{payout.dispute.id.slice(0, 8)}</span> · {payout.dispute.status.replaceAll("_", " ").toLowerCase()} · {payout.dispute.reason.replaceAll("_", " ").toLowerCase()}</p><p className="mt-2 break-words text-muted-foreground">{payout.dispute.explanation}</p></div>}
    {payout.status === "UNKNOWN" && <p className="mt-3 text-sm">The transfer outcome is unknown. Check the bank app for this exact reference before choosing an outcome. Do not transfer again.</p>}
    {payout.status === "FAILED" && payout.attempt?.state === "CONFIRMATION_CORRECTED" && <p role="status" className="mt-3 text-sm font-medium">Staff confirmation corrected — awaiting authorized retry. This is an accounting correction, not a bank return.</p>}
    {!canReconcile ? <p className="mt-3 text-sm text-muted-foreground">Only an administrator can resolve, correct or authorize a retry. You can add information through a problem report on your own attempt.</p> :
      <div className="mt-4 flex flex-wrap gap-3">
        {has("RESOLVE") && <button type="button" className={sellerButton} disabled={pending} onClick={() => open("resolve")}>Record reconciled outcome</button>}
        {has("REVIEW_DISPUTE") && <button type="button" className={sellerButton} disabled={pending} onClick={() => open("review")}>Review seller case</button>}
        {has("RETRY") && <button type="button" className={sellerButton} disabled={pending} onClick={() => open("retry")}>Authorize retry on this payout</button>}
      </div>}
    {canReconcile && dialog === "resolve" && <ManualPayoutDialog title="Record reconciled outcome" submitLabel="Record outcome" pending={pending} error={localError || error} onClose={() => setDialog(null)}
      description={<>Choose what the bank app shows for reference <span className="font-mono text-foreground">{payout.attempt?.reference ?? "not issued"}</span>. A sent outcome keeps the original payment; a not-sent outcome needs a separate retry.</>}
      onSubmit={() => { const parsed = parseResolutionForm(outcome, reason, proof, payout.dispute); if (!parsed.ok) { setLocalError(parsed.error); return; } setLocalError(""); resolve(parsed.value); }}>
      <label className="grid gap-2 text-xs">Outcome<select className={sellerInput} value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="">Choose an outcome</option>{outcomesFor(payout).map((value) => <option key={value} value={value}>{outcomeLabels[value]}</option>)}</select></label>
      <label className="grid gap-2 text-xs">Reason<textarea className={sellerInput} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <fieldset className="grid gap-2 text-xs"><legend className="mb-2">Proof from this attempt {resolutionNeedsProof(outcome) ? "(required)" : "(optional)"}</legend>{evidence.length ? evidence.map((file) => <label key={file.id} className="flex items-center gap-2"><input type="checkbox" checked={proof.includes(file.id)} onChange={(event) => setProof((value) => event.target.checked ? [...value, file.id] : value.filter((id) => id !== file.id))} />{file.fileName}</label>) : <p className="text-muted-foreground">Upload proof to this attempt first.</p>}</fieldset>
    </ManualPayoutDialog>}
    {canReconcile && dialog === "review" && payout.dispute && <ManualPayoutDialog title="Review seller case" submitLabel="Save review" pending={pending} error={localError || error} onClose={() => setDialog(null)}
      description="A review asks the seller for information or tells them transfer evidence exists. It never confirms receipt on the seller's behalf."
      onSubmit={() => { const parsed = payout.dispute && parseReviewForm(decision, reason, payout.dispute); if (!parsed || !parsed.ok) { setLocalError(parsed ? parsed.error : "The seller case is no longer open."); return; } setLocalError(""); review(parsed.value); }}>
      <label className="grid gap-2 text-xs">Decision<select className={sellerInput} value={decision} onChange={(event) => setDecision(event.target.value)}><option value="">Choose a decision</option><option value="REQUEST_INFORMATION">Request information from the seller</option><option value="TRANSFER_EVIDENCE_PROVIDED">Transfer evidence provided to the seller</option></select></label>
      <label className="grid gap-2 text-xs">Note to the case<textarea className={sellerInput} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    </ManualPayoutDialog>}
    {canReconcile && dialog === "retry" && <ManualPayoutDialog title="Authorize retry" submitLabel="Authorize retry" pending={pending} error={localError || error} onClose={() => setDialog(null)}
      description="The same payout returns to the queue and a new attempt gets a new reference. Authorize only after the earlier attempt is reconciled as not sent, returned or corrected."
      onSubmit={() => { const parsed = parseRetryForm(reason); if (!parsed.ok) { setLocalError(parsed.error); return; } setLocalError(""); retry(parsed.value); }}>
      <label className="grid gap-2 text-xs">Authorization reason<textarea className={sellerInput} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    </ManualPayoutDialog>}
  </section>;
}

export default ManualPayoutReconciliationPanel;
