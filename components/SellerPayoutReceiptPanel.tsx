"use client";

import { useEffect, useRef, useState } from "react";
import ManualPayoutDialog from "./ManualPayoutDialog";
import { sellerButton, sellerInput, sellerPrimary } from "./SellerUi";
import { useAuth } from "../hooks/useAuth";
import { useApiMutation } from "../hooks/useApi";
import { confirmPayoutReceipt, disputePayoutReceipt } from "../service/sellerPayoutReceiptService";
import { manualPayoutErrorMessage } from "../service/manualPayoutService";
import { parseSellerDisputeForm } from "../features/manualPayoutSchema";
import type { PayoutDetail } from "../types/payoutType";
import type { ReceiptDisputeInput } from "../types/payoutReceiptType";

type Pending = { key: string; payload: string };
type Command = { scope: string; key: string; sessionId: number; controller: AbortController; dispute: ReceiptDisputeInput | null; attemptId: string; version: number };
const reasonLabels: Record<string, string> = { NOT_RECEIVED: "The money has not arrived", INCORRECT_AMOUNT: "A different amount arrived", CONFIRMATION_MISTAKE: "I confirmed receipt by mistake" };
const caseLabel = (status: string) => status === "OPEN" ? "Open" : status === "UNDER_REVIEW" ? "Under review" : status === "WAITING_SELLER" ? "Waiting for you" : "Resolved";

type Props = { payout: PayoutDetail; keys: Map<string, Pending>; updated: (detail: PayoutDetail) => void; reload: () => Promise<unknown> };

function SellerPayoutReceiptPanel({ payout, keys, updated, reload }: Props) {
  const auth = useAuth();
  const attempt = payout.manualAttempt;
  const active = useRef<AbortController | null>(null);
  const [dialog, setDialog] = useState(false);
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState("");
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => () => active.current?.abort(), []);
  const mutation = useApiMutation<PayoutDetail, Command>({
    mutationKey: ["seller-receipt", auth.sessionId, payout.id],
    execute: ({ key, controller, dispute, attemptId, version }) => dispute
      ? disputePayoutReceipt(payout.id, attemptId, { idempotencyKey: key, expectedReceiptVersion: version, body: dispute }, { context: auth.requestContext, signal: controller.signal })
      : confirmPayoutReceipt(payout.id, attemptId, { idempotencyKey: key, expectedReceiptVersion: version }, { context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
  }, {
    onSuccess: (result, command) => { keys.delete(command.scope); updated(result); setDialog(false); setMessage(command.dispute ? "Your review request was sent. No payment or refund is started by this request." : "Thanks. Your receipt confirmation was recorded."); },
    onError: async (error, command) => { if (!auth.isSessionCurrent(command.sessionId) || command.controller.signal.aborted) return; if (error.kind !== "network") keys.delete(command.scope); await reload(); },
    onSettled: (_result, _error, command) => { if (active.current === command.controller) active.current = null; },
  });
  if (payout.executionMode !== "MANUAL" || !attempt) return null;
  const allowed = (action: string) => attempt.allowedSellerActions.some((entry) => entry === action);
  const send = (action: string, dispute: ReceiptDisputeInput | null) => {
    if (active.current) return;
    const scope = `${payout.id}:${attempt.attemptId}:${action}:${attempt.receiptVersion}`, payload = JSON.stringify(dispute), previous = keys.get(scope);
    const key = previous && previous.payload === payload ? previous.key : crypto.randomUUID();
    keys.set(scope, { key, payload });
    const controller = new AbortController(); active.current = controller; setMessage("");
    mutation.mutate({ scope, key, sessionId: auth.sessionId, controller, dispute, attemptId: attempt.attemptId, version: attempt.receiptVersion });
  };
  const error = mutation.error && mutation.error.kind !== "aborted" ? manualPayoutErrorMessage(mutation.error) : "";
  const status = attempt.state !== "SUCCEEDED" || !attempt.staffConfirmedAt ? "No staff transfer is recorded for this attempt yet." :
    attempt.receiptStatus === "CONFIRMED" ? "You confirmed that you received this payout." : attempt.receiptStatus === "DISPUTED" ? "You asked for a review of this payout." :
    "Staff confirmed transfer — awaiting your confirmation. Check your bank account before confirming.";
  return <section aria-label="Payout receipt" className="mt-6 rounded-sm border border-border p-4">
    <h3 className="text-sm font-semibold">Receipt for manual attempt {attempt.attemptNo}</h3>
    <p role="status" className="mt-2 text-sm">{status}</p>
    <p className="mt-2 text-xs text-muted-foreground">A staff confirmation is not a bank verification. Your answer updates the receipt record only; it does not change the order or move money.</p>
    {attempt.dispute && <p className="mt-3 text-sm">Review case · {caseLabel(attempt.dispute.status)} · {reasonLabels[attempt.dispute.reason]}<span className="mt-1 block break-words text-xs text-muted-foreground">{attempt.dispute.explanation}</span></p>}
    {(allowed("CONFIRM_RECEIPT") || allowed("DISPUTE_RECEIPT")) && <div className="mt-4 flex flex-wrap gap-3">
      {allowed("CONFIRM_RECEIPT") && <button type="button" className={sellerPrimary} disabled={mutation.isPending} onClick={() => send("CONFIRM_RECEIPT", null)}>I received the money</button>}
      {allowed("DISPUTE_RECEIPT") && <button type="button" className={sellerButton} disabled={mutation.isPending} onClick={() => { setReason(attempt.receiptStatus === "CONFIRMED" ? "CONFIRMATION_MISTAKE" : ""); setExplanation(""); setFormError(""); setDialog(true); }}>Not received / Request review</button>}
    </div>}
    {message && <p role="status" className="mt-3 text-sm text-success">{message}</p>}
    {error && !dialog && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    {dialog && <ManualPayoutDialog title="Request a payout review" submitLabel="Send review request" pending={mutation.isPending} error={formError || error || undefined} onClose={() => setDialog(false)}
      description="Tell us what you see in your bank account. You do not need to send a bank statement. Staff will review the transfer; no new payment is started automatically."
      onSubmit={() => { const parsed = parseSellerDisputeForm(reason, explanation); if (!parsed.ok) { setFormError(parsed.error); return; } setFormError(""); send("DISPUTE_RECEIPT", parsed.value); }}>
      <label className="grid gap-2 text-xs">Reason<select className={sellerInput} value={reason} onChange={(event) => setReason(event.target.value)}><option value="">Choose a reason</option>{Object.entries(reasonLabels).filter(([value]) => attempt.receiptStatus === "CONFIRMED" || value !== "CONFIRMATION_MISTAKE").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="grid gap-2 text-xs">Explanation<textarea className={sellerInput} rows={3} maxLength={1000} value={explanation} onChange={(event) => setExplanation(event.target.value)} /></label>
    </ManualPayoutDialog>}
  </section>;
}

export default SellerPayoutReceiptPanel;
