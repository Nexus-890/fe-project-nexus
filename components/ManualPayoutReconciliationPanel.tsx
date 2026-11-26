"use client";

import { useState } from "react";
import ManualPayoutDialog from "./ManualPayoutDialog";
import { sellerButton, sellerInput } from "./SellerUi";
import { emptyTransferFacts, evidenceLabel, parseResolutionForm, parseRetryForm, parseReviewForm, qrIssuedAt, resolutionNeedsFacts, resolutionOutcomes, type TransferFacts } from "../features/manualPayoutSchema";
import type { DisputeReviewInput, ManualCase, ManualPayout, ManualRecipient, ManualResolutionInput, SourceAccount } from "../types/manualPayoutType";
import { MoneyInput, groupedVnd } from "./moneyInput";

type Dialog = "resolve" | "review" | "retry" | null;
type Props = {
  payout: ManualPayout;
  canReconcile: boolean;
  sourceAccounts: SourceAccount[];
  serverNow: () => number;
  pending: boolean;
  error?: string;
  resolve: (input: ManualResolutionInput) => void;
  review: (dispute: ManualCase, input: DisputeReviewInput) => void;
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
const masked = (recipient: ManualRecipient) => `${recipient.bankCode} · ${recipient.holderName} · •••• ${recipient.accountLast4}`;

function BankChangeSteps({ payout }: { payout: ManualPayout }) {
  const next = payout.sellerDefaultRecipient;
  const current = payout.status === "UNKNOWN" ? 0 : payout.status === "FAILED" && payout.currentAttempt?.state === "NOT_SENT" ? 2 : -1;
  if (!next || !payout.recipient || current < 0) return null;
  const reference = payout.currentAttempt?.reference ?? "this attempt";
  const steps = [
    `Check the banking app for reference ${reference}. If money already went to •••• ${payout.recipient.accountLast4}, record "Bank app shows the transfer was sent" and stop here.`,
    `If nothing was sent, upload a screenshot of the banking app as proof, then Record reconciled outcome and choose "Bank app shows no transfer was sent". This closes every open case on this attempt.`,
    "Authorize retry on this payout.",
    `Claim the payout again. The new QR pays •••• ${next.accountLast4}.`,
  ];
  return <div role="status" aria-label="Seller changed the receiving account" className="mt-3 rounded-sm border border-warning/40 bg-background p-3 text-sm">
    <p className="font-medium">The seller changed the receiving account after this QR was issued.</p>
    <p className="mt-1">The issued QR pays <span className="font-mono">{masked(payout.recipient)}</span>. The seller&apos;s default is now <span className="font-mono">{masked(next)}</span>. This attempt cannot issue a new QR, and refreshing does not switch the account.</p>
    <ol className="mt-2 list-decimal space-y-1 pl-5">{steps.map((step, index) => <li key={step} aria-current={index === current ? "step" : undefined} className={index < current ? "text-muted-foreground line-through" : index === current ? "font-medium" : ""}>{step}</li>)}</ol>
  </div>;
}

const caseLabel = (entry: ManualCase) => `${entry.kind === "SELLER_DISPUTE" ? "Seller case" : "Staff exception"} ${entry.id.slice(0, 8)} · ${entry.status.replaceAll("_", " ").toLowerCase()} · ${entry.reason.replaceAll("_", " ").toLowerCase()}`;

function ManualPayoutReconciliationPanel({ payout, canReconcile, sourceAccounts, serverNow, pending, error, resolve, review, retry, dialog, setDialog }: Props) {
  const [caseId, setCaseId] = useState("");
  const [outcome, setOutcome] = useState("");
  const [reason, setReason] = useState("");
  const [proof, setProof] = useState<string[]>([]);
  const [facts, setFacts] = useState<TransferFacts>(emptyTransferFacts);
  const [decision, setDecision] = useState("");
  const [localError, setLocalError] = useState("");
  const has = (action: string) => payout.allowedActions.some((entry) => entry === action);
  const attempt = payout.currentAttempt;
  const open = (next: Dialog) => { setLocalError(""); setReason(""); setProof([]); setOutcome(""); setDecision(""); setFacts(emptyTransferFacts); setCaseId(payout.openCases[0]?.id ?? ""); setDialog(next); };
  const selected = payout.openCases.find((entry) => entry.id === caseId) ?? null;
  const outcomes = resolutionOutcomes(attempt?.state, payout.status, selected);
  const reviewNeeded = payout.needsReview || ["FAILED", "RETURNED"].includes(payout.status);
  if (!reviewNeeded && !has("RESOLVE") && !has("REVIEW_DISPUTE") && !has("RETRY")) return null;
  const proofPicker = (required: boolean) => <fieldset className="grid gap-2 text-xs"><legend className="mb-2">Proof from this attempt {required ? "(1-3 required)" : "(optional)"}</legend>
    {payout.evidence.length ? payout.evidence.map((file, index) => <label key={file.id} className="flex items-center gap-2"><input type="checkbox" checked={proof.includes(file.id)} onChange={(event) => setProof((value) => event.target.checked ? [...value, file.id] : value.filter((id) => id !== file.id))} />{evidenceLabel(file, index)}</label>) :
      <p className="text-muted-foreground">Upload proof to this attempt first.</p>}</fieldset>;
  return <section aria-label="Reconciliation" className="mt-6 rounded-sm border border-warning/30 bg-warning/5 p-4">
    <h3 className="text-sm font-semibold">Reconciliation</h3>
    {payout.openCases.length > 0 && <ul className="mt-3 grid gap-2 text-sm">{payout.openCases.map((entry) => <li key={entry.id}><p>{caseLabel(entry)}</p>{entry.explanation && <p className="mt-1 break-words text-xs text-muted-foreground">{entry.explanation}</p>}</li>)}</ul>}
    {payout.status === "UNKNOWN" && <p className="mt-3 text-sm">The transfer outcome is unknown. Check the bank app for this exact reference before choosing an outcome. Do not transfer again.</p>}
    <BankChangeSteps payout={payout} />
    {payout.status === "FAILED" && attempt?.state === "NOT_SENT" && !payout.sellerDefaultRecipient && has("RETRY") && <p role="status" className="mt-3 text-sm font-medium">Recorded as not sent. Next: authorize a retry. The payout goes back to Ready to claim, and the next claim uses the seller&apos;s current default account.</p>}
    {payout.status === "FAILED" && attempt?.state === "CONFIRMATION_CORRECTED" && <p role="status" className="mt-3 text-sm font-medium">Staff confirmation corrected — awaiting authorized retry. This is an accounting correction, not a bank return.</p>}
    {!canReconcile ? <p className="mt-3 text-sm text-muted-foreground">Only an administrator can resolve, correct or authorize a retry. You can add information through a problem report on your own attempt.</p> :
      <div className="mt-4 flex flex-wrap gap-3">
        {has("RESOLVE") && <button type="button" className={sellerButton} disabled={pending} onClick={() => open("resolve")}>Record reconciled outcome</button>}
        {has("REVIEW_DISPUTE") && <button type="button" className={sellerButton} disabled={pending} onClick={() => open("review")}>Review seller case</button>}
        {has("RETRY") && <button type="button" className={sellerButton} disabled={pending} onClick={() => open("retry")}>Authorize retry on this payout</button>}
      </div>}
    {canReconcile && dialog === "resolve" && attempt && <ManualPayoutDialog title="Record reconciled outcome" submitLabel="Record outcome" pending={pending} error={localError || error} onClose={() => setDialog(null)}
      description={<>Choose what the bank app shows for reference <span className="font-mono text-foreground">{attempt.reference ?? "not issued"}</span>. A sent outcome keeps the original payment; a not-sent outcome needs a separate retry.</>}
      onSubmit={() => { const parsed = parseResolutionForm({ caseId, outcome, reason, evidenceIds: proof, facts }, { attemptState: attempt.state, payoutStatus: payout.status, openCases: payout.openCases, netAmount: payout.netAmount, sourceIds: sourceAccounts.map((account) => account.id), serverNow: serverNow(), issuedAt: qrIssuedAt(payout, attempt.id) });
        if (!parsed.ok) { setLocalError(parsed.error); return; } setLocalError(""); resolve(parsed.value); }}>
      <label className="grid gap-2 text-xs">Case<select className={sellerInput} value={caseId} onChange={(event) => { setCaseId(event.target.value); setOutcome(""); }}>{payout.openCases.map((entry) => <option key={entry.id} value={entry.id}>{caseLabel(entry)}</option>)}</select></label>
      <label className="grid gap-2 text-xs">Outcome<select className={sellerInput} value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="">Choose an outcome</option>{outcomes.map((value) => <option key={value} value={value}>{value === "CONFIRMED_SENT" && attempt.state === "SUCCEEDED" ? "The recorded transfer was correct (close this exception only)" : outcomeLabels[value]}</option>)}</select></label>
      {resolutionNeedsFacts(outcome, attempt.state) && <>
        <label className="grid gap-2 text-xs">Platform source account<select className={sellerInput} value={facts.sourceAccountId} onChange={(event) => setFacts((value) => ({ ...value, sourceAccountId: event.target.value }))}><option value="">Choose the account it was sent from</option>{sourceAccounts.map((account) => <option key={account.id} value={account.id}>{account.alias}</option>)}</select></label>
        <label className="grid gap-2 text-xs">Transferred amount (VND)<MoneyInput className={sellerInput} value={facts.amount} placeholder={groupedVnd(payout.netAmount)} onValueChange={(amount) => setFacts((value) => ({ ...value, amount }))} /></label>
        <label className="grid gap-2 text-xs">Bank transfer reference<input className={sellerInput} value={facts.reference} maxLength={120} onChange={(event) => setFacts((value) => ({ ...value, reference: event.target.value }))} /></label>
        <label className="grid gap-2 text-xs">Transferred at (Vietnam time)<input type="datetime-local" className={sellerInput} value={facts.transferredAt} onChange={(event) => setFacts((value) => ({ ...value, transferredAt: event.target.value }))} /></label>
      </>}
      <label className="grid gap-2 text-xs">Reason<textarea className={sellerInput} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      {proofPicker(true)}
    </ManualPayoutDialog>}
    {canReconcile && dialog === "review" && payout.openSellerDispute && <ManualPayoutDialog title="Review seller case" submitLabel="Save review" pending={pending} error={localError || error} onClose={() => setDialog(null)}
      description="A review asks the seller for information or tells them transfer evidence exists. It never confirms receipt on the seller's behalf."
      onSubmit={() => { const dispute = payout.openSellerDispute; if (!dispute) { setLocalError("The seller case is no longer open."); return; } const parsed = parseReviewForm(decision, reason, proof, dispute); if (!parsed.ok) { setLocalError(parsed.error); return; } setLocalError(""); review(dispute, parsed.value); }}>
      <label className="grid gap-2 text-xs">Decision<select className={sellerInput} value={decision} onChange={(event) => setDecision(event.target.value)}><option value="">Choose a decision</option><option value="REQUEST_INFORMATION">Request information from the seller</option><option value="TRANSFER_EVIDENCE_PROVIDED">Transfer evidence provided to the seller</option></select></label>
      <label className="grid gap-2 text-xs">Note to the case<textarea className={sellerInput} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      {proofPicker(decision === "TRANSFER_EVIDENCE_PROVIDED")}
    </ManualPayoutDialog>}
    {canReconcile && dialog === "retry" && <ManualPayoutDialog title="Authorize retry" submitLabel="Authorize retry" pending={pending} error={localError || error} onClose={() => setDialog(null)}
      description={<>The same payout returns to the queue and a new attempt gets a new reference. Authorize only after the earlier attempt is reconciled as not sent, returned or corrected.{payout.sellerDefaultRecipient && <> The next claim pays the seller&apos;s new default account <span className="font-mono text-foreground">•••• {payout.sellerDefaultRecipient.accountLast4}</span>.</>}</>}
      onSubmit={() => { const parsed = parseRetryForm(reason); if (!parsed.ok) { setLocalError(parsed.error); return; } setLocalError(""); retry(parsed.value); }}>
      <label className="grid gap-2 text-xs">Authorization reason<textarea className={sellerInput} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    </ManualPayoutDialog>}
  </section>;
}

export default ManualPayoutReconciliationPanel;
