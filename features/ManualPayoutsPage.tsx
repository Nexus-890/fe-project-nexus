"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError } from "../configs/api";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import {
  checkManualPayoutReadiness, claimManualPayout, confirmManualPayout, getManualPayoutCapabilities, getManualPayoutDetail, getManualPayoutEvidence, getManualPayoutQr,
  getManualPayouts, issueManualPayoutQr, manualPayoutErrorMessage, releaseManualPayoutClaim, reportManualPayoutProblem, resolveManualPayout, retryManualPayout,
  reviewReceiptDispute, uploadManualPayoutEvidence,
} from "../service/manualPayoutService";
import { formatVND } from "../components/formatPrice";
import ManualPayoutDialog from "../components/ManualPayoutDialog";
import ManualPayoutReconciliationPanel from "../components/ManualPayoutReconciliationPanel";
import ManualPayoutTable, { manualStatusLabel, receiptLabel } from "../components/ManualPayoutTable";
import { SellerHeading, SellerPanel, SellerStatus, sellerButton, sellerInput, sellerPrimary } from "../components/SellerUi";
import { readBackofficeRoles, readBackofficeSubject } from "./backofficeAccess";
import {
  combineQueueFilters, emptyQueueForm, emptyTransferFacts, evidenceFileError, evidenceFileName, evidenceLabel, formatCountdown, manualQueueViews, parseConfirmationForm, parseProblemForm, parseQueueForm, qrIssuedAt, attemptOwner,
  secondsUntil, serverOffset, type ConfirmationForm, type ManualQueueForm, type ManualQueueView,
} from "./manualPayoutSchema";
import type { ManualCommand, ManualEvidence, ManualPayout, ManualPayoutCapabilities, ManualPayoutFilters } from "../types/manualPayoutType";
import { payoutStatuses } from "../types/payoutType";
import { receiptStatuses } from "../types/payoutReceiptType";
import type { ApiError } from "../types/commonResponseType";
import { MoneyInput, groupedVnd } from "../components/moneyInput";

const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const asApiError = (error: unknown): ApiError => isApiError(error) ? error : { kind: "network", status: 0, title: "The request failed" };
const sourceLabel = (source: string | null) => source === "MANUAL_STAFF_CONFIRMED" ? "Staff-confirmed manual transfer" : "Not confirmed";
const words = (value: string) => value.replaceAll("_", " ").toLowerCase();

type PendingKey = { key: string; payload: string };
type Send = (command: { idempotencyKey: string; signal: AbortSignal }) => Promise<ManualPayout>;
type Run = { scope: string; key: string; sessionId: number; controller: AbortController; success: string; send: Send };
type DialogKind = "confirm" | "problem" | "resolve" | "review" | "retry" | null;

function QrImage({ payoutId, attemptId, reference, amount, last4 }: { payoutId: string; attemptId: string; reference: string; amount: string; last4: string }) {
  const auth = useAuth();
  const [state, setState] = useState<{ url: string } | { error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let url: string | null = null;
    getManualPayoutQr(payoutId, attemptId, { context: auth.requestContext, signal: controller.signal })
      .then((blob) => { if (controller.signal.aborted) return; url = URL.createObjectURL(blob); setState({ url }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState({ error: manualPayoutErrorMessage(asApiError(error)) }); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [payoutId, attemptId, auth.requestContext, attempt]);
  return <figure className="mt-4 grid justify-items-start gap-3">
    {state && "url" in state ? <img src={state.url} alt={`Transfer QR for reference ${reference}, ${formatVND(amount)} to account ending ${last4}`} width={220} height={220} className="size-56 rounded-sm border border-border bg-background p-2 [image-rendering:pixelated]" /> :
      state ? <div><p role="alert" className="text-sm text-danger">{state.error}</p><button type="button" className={`${sellerButton} mt-3`} onClick={() => { setState(null); setAttempt((value) => value + 1); }}>Load QR again</button></div> :
      <p role="status" className="text-sm">Loading the transfer QR…</p>}
    <figcaption className="max-w-md text-xs text-muted-foreground">Scan in the platform banking app. The QR holds the full account details; the screen shows only the masked account. Check the recipient and amount in the banking app before sending.</figcaption>
  </figure>;
}

function EvidenceFile({ payoutId, attemptId, file, index }: { payoutId: string; attemptId: string; file: ManualEvidence; index: number }) {
  const name = evidenceFileName(file);
  const auth = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const current = useRef<string | null>(null);
  useEffect(() => () => { controller.current?.abort(); if (current.current) URL.revokeObjectURL(current.current); }, []);
  const load = () => {
    controller.current?.abort();
    const next = new AbortController(); controller.current = next;
    setLoading(true); setError("");
    getManualPayoutEvidence(payoutId, attemptId, file.id, { context: auth.requestContext, signal: next.signal })
      .then((blob) => { if (next.signal.aborted) return; const link = URL.createObjectURL(blob); if (current.current) URL.revokeObjectURL(current.current); current.current = link; setUrl(link); })
      .catch((reason: unknown) => { if (!next.signal.aborted) setError(manualPayoutErrorMessage(asApiError(reason))); })
      .finally(() => { if (!next.signal.aborted) setLoading(false); });
  };
  return <li className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border p-3 text-xs">
    <span className="min-w-0 break-all">{evidenceLabel(file, index)}</span>
    {url ? <a className={sellerButton} href={url} download={name}>Save evidence {index + 1}</a> : <button type="button" className={sellerButton} disabled={loading} onClick={load}>{loading ? "Loading…" : `Open evidence ${index + 1}`}</button>}
    {error && <p role="alert" className="basis-full text-danger">{error}</p>}
  </li>;
}

function ManualPayoutDetailPanel({ id, capabilities, keys, subject, close }: { id: string; capabilities: ManualPayoutCapabilities; keys: Map<string, PendingKey>; subject: string | null; close: () => void }) {
  const auth = useAuth();
  const client = useQueryClient();
  const active = useRef<AbortController | null>(null);
  const [last, setLast] = useState<Omit<Run, "sessionId" | "controller"> | null>(null);
  const expired = useRef<string | null>(null);
  const [message, setMessage] = useState("");
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [now, setNow] = useState(() => Date.now());
  const [fileError, setFileError] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationForm>({ ...emptyTransferFacts, evidenceIds: [], attested: false });
  const [problem, setProblem] = useState({ reason: "", evidenceIds: [] as string[] });
  const [formError, setFormError] = useState("");
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => { window.clearInterval(timer); active.current?.abort(); }; }, []);
  const detail = useApiQuery({ queryKey: queryKeys.backoffice.manualPayout(auth.sessionId, id), meta: { requiresAuth: true },
    service: (signal) => getManualPayoutDetail(id, { context: auth.requestContext, signal }) }, { retry: false, staleTime: 0, refetchOnMount: "always" });
  const mutation = useApiMutation<ManualPayout, Run>({
    mutationKey: ["manual-payouts", auth.sessionId, id, "command"],
    execute: ({ key, controller, send }) => send({ idempotencyKey: key, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey: [queryKeys.backoffice.manualPayouts(auth.sessionId)],
  }, {
    onSuccess: (result, run) => { client.setQueryData(queryKeys.backoffice.manualPayout(auth.sessionId, id), result); keys.delete(run.scope); setLast(null); setDialog(null); setFormError(""); setMessage(run.success); },
    onError: async (error, run) => {
      if (!auth.isSessionCurrent(run.sessionId) || run.controller.signal.aborted) return;
      if (error.kind !== "network") { keys.delete(run.scope); setLast(null); }
      await detail.refetch();
    },
    onSettled: (_result, _error, run) => { if (active.current === run.controller) active.current = null; },
  });
  const payout = detail.data;
  const attempt = payout?.currentAttempt ?? null;
  const offset = payout ? serverOffset(payout.serverTime, detail.dataUpdatedAt) : 0;
  const deadline = attempt?.state === "QR_ISSUED" ? attempt.qrExpiresAt : attempt?.state === "CLAIMED" ? attempt.claimExpiresAt : null;
  const remaining = secondsUntil(deadline, offset, now);
  useEffect(() => {
    if (remaining === 0 && deadline && expired.current !== deadline && !detail.isFetching) { expired.current = deadline; void detail.refetch(); }
  }, [remaining, deadline, detail]);
  const has = (action: string) => !!payout && payout.allowedActions.some((entry) => entry === action);
  const scopeOf = (action: string) => payout ? `${payout.id}:${action}:${attempt?.id ?? "-"}:${payout.version}:${attempt?.version ?? "-"}` : "";
  const dispatch = (job: Omit<Run, "sessionId" | "controller">) => {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller; setLast(job);
    setMessage(""); mutation.mutate({ ...job, sessionId: auth.sessionId, controller });
  };
  const run = (action: string, payload: unknown, success: string, send: Send) => {
    if (!payout || active.current) return;
    const scope = scopeOf(action), json = JSON.stringify(payload ?? null), previous = keys.get(scope);
    const key = previous && previous.payload === json ? previous.key : crypto.randomUUID();
    keys.set(scope, { key, payload: json });
    dispatch({ scope, key, success, send });
  };
  const options = (signal: AbortSignal) => ({ context: auth.requestContext, signal });
  const cmd = <T,>(idempotencyKey: string, expectedVersion: number, body?: T): ManualCommand<T> => ({ idempotencyKey, expectedVersion, ...(body === undefined ? {} : { body }) });
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || !payout || !attempt) return;
    const problemText = evidenceFileError(file, payout.evidence.length);
    setFileError(problemText ?? "");
    if (problemText) return;
    const version = attempt.version, attemptId = attempt.id;
    run("UPLOAD_EVIDENCE", { name: file.name, size: file.size, type: file.type, modified: file.lastModified }, `${file.name} was attached to attempt ${attempt.attemptNo}.`,
      ({ idempotencyKey, signal }) => uploadManualPayoutEvidence(payout.id, attemptId, file, cmd(idempotencyKey, version), options(signal)));
  };
  const lastError = mutation.error && mutation.error.kind !== "aborted" ? mutation.error : null;
  const canRetrySame = lastError?.kind === "network" && last !== null && last.scope.startsWith(`${id}:`) && last.scope.endsWith(`:${payout?.version}:${attempt?.version ?? "-"}`);
  const ownPayout = !!payout && subject === payout.sellerId;
  const pending = mutation.isPending;
  const closeDialog = () => { setDialog(null); setFormError(""); };
  const openDialog = (next: typeof dialog) => { if (next !== null) mutation.reset(); setFormError(""); setDialog(next); };
  return <SellerPanel title="Manual payout">
    <div className="flex flex-wrap items-start justify-between gap-3"><p className="break-all font-mono text-xs text-muted-foreground">{id}</p><button type="button" className={sellerButton} disabled={pending} onClick={close}>Close payout</button></div>
    {detail.isPending ? <p role="status" className="mt-5 text-sm">Loading payout…</p> : detail.error && !payout ? <div className="mt-5"><p role="alert" className="text-sm text-danger">{manualPayoutErrorMessage(detail.error)}</p><button type="button" className={`${sellerButton} mt-3`} onClick={() => void detail.refetch()}>Retry payout</button></div> : payout && <>
      <div className="mt-5 flex flex-wrap items-center gap-2"><SellerStatus>{manualStatusLabel(payout.status)}</SellerStatus><span className="rounded-full bg-secondary px-2 py-1 text-xs">{payout.executionMode === "MANUAL" ? "Manual" : "Automatic"}</span>{attempt && <span className="rounded-full bg-secondary px-2 py-1 text-xs">Attempt {attempt.attemptNo} · {attempt.state.replaceAll("_", " ").toLowerCase()}</span>}</div>
      {detail.error && <p role="alert" className="mt-3 text-sm text-danger">{manualPayoutErrorMessage(detail.error)} Showing the last loaded state.</p>}
      {ownPayout && <p role="status" className="mt-4 rounded-sm border border-warning/30 bg-warning/10 p-4 text-sm">This is your own seller payout. Staff execution and reconciliation are blocked; use My payouts for receipt actions.</p>}
      {payout.blockedReason && <p role="status" className="mt-4 rounded-sm border border-warning/30 bg-warning/10 p-4 text-sm">Blocked: {payout.blockedReason}</p>}
      {payout.status === "SUCCEEDED" && payout.confirmationSource === "MANUAL_STAFF_CONFIRMED" && <p role="status" className="mt-4 rounded-sm border border-success/30 bg-success/10 p-4 text-sm">{attempt?.receiptStatus === "CONFIRMED" ? "Staff confirmed transfer. The seller confirmed receipt." : attempt?.receiptStatus === "DISPUTED" ? "Staff confirmed transfer. The seller requested a review." : "Staff confirmed transfer — awaiting seller confirmation."} This is not a bank verification.</p>}
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        {[["Order", payout.orderId], ["Seller", payout.sellerId], ["Owner", (() => { const owner = attemptOwner(payout); return owner === null ? "Unclaimed" : owner === subject ? "You" : owner; })()], ["Confirmation source", sourceLabel(payout.confirmationSource)],
          ["Transfer reference", (attemptOwner(payout) && attempt?.reference) || "Issued when claimed"], ["Seller receipt", receiptLabel(attempt?.receiptStatus ?? null)]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-all font-mono text-xs">{value}</dd></div>)}
        {deadline && remaining !== null && <div><dt className="text-xs text-muted-foreground">{attempt?.state === "QR_ISSUED" ? "QR deadline (server time)" : "Claim lease (server time)"}</dt><dd className="mt-1 font-mono text-xs"><time dateTime={deadline}>{date.format(new Date(deadline))}</time> · <span aria-live="off">{remaining > 0 ? `${formatCountdown(remaining)} left` : "Expired — refresh to reconcile"}</span></dd></div>}
      </dl>
      {attempt?.state === "QR_ISSUED" && <p className="mt-3 text-xs text-muted-foreground">The deadline belongs to the platform, not the bank: a saved QR can still work in a banking app after it. After expiry this attempt needs reconciliation and is never requeued automatically.</p>}
      <section aria-label="Receiving account" className="mt-5 rounded-sm border border-border p-4 text-sm"><h3 className="text-xs text-muted-foreground">Receiving account</h3>{payout.recipient ? <p className="mt-2">{payout.recipient.bankCode} · {payout.recipient.holderName} · <span className="font-mono">•••• {payout.recipient.accountLast4}</span></p> : <p className="mt-2 text-muted-foreground">No verified receiving account.</p>}</section>
      <dl aria-label="Payout amount breakdown" className="mt-5 space-y-3 border-y border-border py-5 text-sm">{[["Order amount", payout.orderAmount], ["Shipping fee", payout.shippingFee], ["Platform fee", payout.platformFee], ["Net amount to transfer", payout.netAmount]].map(([label, amount]) => <div key={label} className="flex flex-wrap justify-between gap-3"><dt className={label.startsWith("Net") ? "font-semibold" : "text-muted-foreground"}>{label}</dt><dd className={`font-mono ${label.startsWith("Net") ? "font-semibold text-primary" : ""}`}>{formatVND(amount)} <span className="text-xs text-muted-foreground">({amount})</span></dd></div>)}</dl>
      {!ownPayout && <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className={sellerButton} disabled={detail.isFetching || pending} onClick={() => { setMessage(""); void detail.refetch(); }}>Refresh payout</button>
        {has("READINESS_CHECK") && <button type="button" className={sellerButton} disabled={pending} onClick={() => run("READINESS_CHECK", null, "Readiness was rechecked. Review the status and blocked reason.", ({ idempotencyKey, signal }) => checkManualPayoutReadiness(payout.id, cmd(idempotencyKey, payout.version), options(signal)))}>Recheck readiness</button>}
        {has("CLAIM") && <button type="button" className={sellerPrimary} disabled={pending} onClick={() => run("CLAIM", null, "You own this payout now. Issue the QR when you are ready to transfer.", ({ idempotencyKey, signal }) => claimManualPayout(payout.id, cmd(idempotencyKey, payout.version), options(signal)))}>Claim this payout</button>}
        {has("ISSUE_QR") && attempt && <button type="button" className={sellerPrimary} disabled={pending} onClick={() => run("ISSUE_QR", null, "The QR was issued for this attempt.", ({ idempotencyKey, signal }) => issueManualPayoutQr(payout.id, attempt.id, cmd(idempotencyKey, attempt.version), options(signal)))}>Issue transfer QR</button>}
        {has("RELEASE") && attempt && <button type="button" className={sellerButton} disabled={pending} onClick={() => run("RELEASE", { reason: "Released before QR issuance" }, "The claim was released. No QR was issued.", ({ idempotencyKey, signal }) => releaseManualPayoutClaim(payout.id, attempt.id, cmd(idempotencyKey, attempt.version, { reason: "Released before QR issuance" }), options(signal)))}>Release claim</button>}
        {has("CONFIRM_TRANSFER") && <button type="button" className={sellerPrimary} disabled={pending} onClick={() => openDialog("confirm")}>Record completed transfer</button>}
        {has("REPORT_PROBLEM") && <button type="button" className={sellerButton} disabled={pending} onClick={() => { setProblem({ reason: "", evidenceIds: [] }); openDialog("problem"); }}>Report a problem</button>}
        {canRetrySame && <button type="button" className={sellerButton} disabled={pending} onClick={() => last && dispatch(last)}>Retry same request</button>}
      </div>}
      {!capabilities.enabled && (payout.status === "PENDING" || attempt?.state === "CLAIMED") && <p className="mt-3 text-xs text-muted-foreground">New claims and QR issuance are paused. Recording and reconciliation of issued attempts stay available.</p>}
      {message && <p role="status" className="mt-3 text-sm text-success">{message}</p>}
      {lastError && dialog === null && <p role="alert" className="mt-3 break-words text-sm text-danger">{manualPayoutErrorMessage(lastError)}</p>}
      {has("READ_QR") && attempt?.reference && payout.recipient && <QrImage key={`${auth.sessionId}:${attempt.id}`} payoutId={payout.id} attemptId={attempt.id} reference={attempt.reference} amount={payout.netAmount} last4={payout.recipient.accountLast4} />}
      {attempt && (payout.evidence.length > 0 || has("UPLOAD_EVIDENCE")) && <section aria-label="Transfer evidence" className="mt-6"><h3 className="text-sm font-semibold">Evidence for attempt {attempt.attemptNo}</h3>
        {payout.evidence.length ? <ul className="mt-3 grid gap-2">{payout.evidence.map((file, index) => <EvidenceFile key={`${auth.sessionId}:${file.id}`} payoutId={payout.id} attemptId={attempt.id} file={file} index={index} />)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No evidence uploaded yet.</p>}
        {has("UPLOAD_EVIDENCE") && <label className="mt-3 grid max-w-md gap-2 text-xs">Add evidence (JPEG, PNG or PDF, up to 10 MiB, at most 3)<input type="file" accept="image/jpeg,image/png,application/pdf" className={sellerInput} disabled={pending} onChange={upload} /></label>}
        {fileError && <p role="alert" className="mt-2 text-sm text-danger">{fileError}</p>}
      </section>}
      <ManualPayoutReconciliationPanel payout={payout} canReconcile={capabilities.canReconcile} sourceAccounts={capabilities.sourceAccounts} serverNow={() => Date.now() + offset} pending={pending} error={lastError ? manualPayoutErrorMessage(lastError) : undefined}
        dialog={dialog === "resolve" || dialog === "review" || dialog === "retry" ? dialog : null} setDialog={openDialog}
        resolve={(input) => attempt && run("RESOLVE", input, "The reconciled outcome was recorded.", ({ idempotencyKey, signal }) => resolveManualPayout(payout.id, attempt.id, { idempotencyKey, expectedPayoutVersion: payout.version, expectedAttemptVersion: attempt.version, body: input }, options(signal)))}
        review={(dispute, input) => attempt && run("REVIEW_DISPUTE", { disputeId: dispute.id, ...input }, "The seller case review was saved.", ({ idempotencyKey, signal }) => reviewReceiptDispute(payout.id, attempt.id, dispute.id, cmd(idempotencyKey, attempt.version, input), options(signal)))}
        retry={(input) => run("RETRY", input, "Retry authorized. The payout is back in the queue for a new attempt.", ({ idempotencyKey, signal }) => retryManualPayout(payout.id, cmd(idempotencyKey, payout.version, input), options(signal)))} />
      {dialog === "confirm" && attempt && <ManualPayoutDialog title="Record completed transfer" submitLabel="Record completed transfer" pending={pending} error={formError || (lastError ? manualPayoutErrorMessage(lastError) : undefined)} onClose={closeDialog}
        description={<>Record a transfer you already made in the banking app for reference <span className="font-mono text-foreground">{attempt.reference}</span>. Nexus does not send money. This records a staff confirmation, not a bank verification.</>}
        onSubmit={() => { const parsed = parseConfirmationForm(confirmation, payout.netAmount, capabilities.sourceAccounts.map((account) => account.id), Date.now() + offset, qrIssuedAt(payout, attempt.id)); if (!parsed.ok) { setFormError(parsed.error); return; } setFormError(""); run("CONFIRM_TRANSFER", parsed.value, "The completed transfer was recorded.", ({ idempotencyKey, signal }) => confirmManualPayout(payout.id, attempt.id, cmd(idempotencyKey, attempt.version, parsed.value), options(signal))); }}>
        <label className="grid gap-2 text-xs">Platform source account<select className={sellerInput} value={confirmation.sourceAccountId} onChange={(event) => setConfirmation((value) => ({ ...value, sourceAccountId: event.target.value }))}><option value="">Choose the account you sent from</option>{capabilities.sourceAccounts.map((account) => <option key={account.id} value={account.id}>{account.alias}</option>)}</select></label>
        <label className="grid gap-2 text-xs">Transferred amount (VND)<MoneyInput className={sellerInput} value={confirmation.amount} placeholder={groupedVnd(payout.netAmount)} onValueChange={(amount) => setConfirmation((value) => ({ ...value, amount }))} /></label>
        <label className="grid gap-2 text-xs">Bank transfer reference<input className={sellerInput} value={confirmation.reference} maxLength={120} onChange={(event) => setConfirmation((value) => ({ ...value, reference: event.target.value }))} /></label>
        <label className="grid gap-2 text-xs">Transferred at (Vietnam time)<input type="datetime-local" className={sellerInput} value={confirmation.transferredAt} onChange={(event) => setConfirmation((value) => ({ ...value, transferredAt: event.target.value }))} /></label>
        <fieldset className="grid gap-2 text-xs"><legend className="mb-2">Evidence from this attempt (1-3)</legend>{payout.evidence.length ? payout.evidence.map((file, index) => <label key={file.id} className="flex items-center gap-2"><input type="checkbox" checked={confirmation.evidenceIds.includes(file.id)} onChange={(event) => setConfirmation((value) => ({ ...value, evidenceIds: event.target.checked ? [...value.evidenceIds, file.id] : value.evidenceIds.filter((entry) => entry !== file.id) }))} />{evidenceLabel(file, index)}</label>) : <p className="text-danger">Upload evidence to this attempt first.</p>}</fieldset>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmation.attested} onChange={(event) => setConfirmation((value) => ({ ...value, attested: event.target.checked }))} />I checked in the banking app that the recipient is {payout.recipient ? `${payout.recipient.holderName} (•••• ${payout.recipient.accountLast4})` : "the verified account"} and the amount is exactly {formatVND(payout.netAmount)}.</label>
      </ManualPayoutDialog>}
      {dialog === "problem" && attempt && <ManualPayoutDialog title="Report a problem" submitLabel="Report problem" pending={pending} error={formError || (lastError ? manualPayoutErrorMessage(lastError) : undefined)} onClose={closeDialog}
        description="Report what you saw in the banking app. An administrator reconciles the attempt. Do not transfer again to fix it."
        onSubmit={() => { const parsed = parseProblemForm(problem.reason, problem.evidenceIds); if (!parsed.ok) { setFormError(parsed.error); return; } setFormError(""); run("REPORT_PROBLEM", parsed.value, "The problem was reported. This attempt now needs reconciliation.", ({ idempotencyKey, signal }) => reportManualPayoutProblem(payout.id, attempt.id, cmd(idempotencyKey, attempt.version, parsed.value), options(signal))); }}>
        <label className="grid gap-2 text-xs">What went wrong in the banking app<textarea className={sellerInput} rows={3} maxLength={1000} value={problem.reason} onChange={(event) => setProblem((value) => ({ ...value, reason: event.target.value }))} /></label>
        {payout.evidence.length > 0 && <fieldset className="grid gap-2 text-xs"><legend className="mb-2">Evidence (optional)</legend>{payout.evidence.map((file, index) => <label key={file.id} className="flex items-center gap-2"><input type="checkbox" checked={problem.evidenceIds.includes(file.id)} onChange={(event) => setProblem((value) => ({ ...value, evidenceIds: event.target.checked ? [...value.evidenceIds, file.id] : value.evidenceIds.filter((entry) => entry !== file.id) }))} />{evidenceLabel(file, index)}</label>)}</fieldset>}
      </ManualPayoutDialog>}
      <section aria-label="Manual payout history" className="mt-6"><h3 className="text-sm font-semibold">History · newest first</h3>{payout.history.length ? <ol className="mt-4 space-y-3">{payout.history.map((step) => <li key={step.id} className="rounded-sm border border-border p-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><p className="font-medium">{words(step.event)}</p><time className="text-xs text-muted-foreground" dateTime={step.occurredAt}>{date.format(new Date(step.occurredAt))}</time></div>
        {(step.attemptId || step.caseId) && <p className="mt-2 font-mono text-xs text-muted-foreground">{[step.attemptId && `Attempt ${step.attemptId.slice(0, 8)}`, step.caseId && `Case ${step.caseId.slice(0, 8)}`].filter(Boolean).join(" · ")}</p>}
        {step.reason && <p className="mt-2 break-words text-xs">{step.reason}</p>}
        <p className="mt-2 break-all text-xs text-muted-foreground">{step.actorRole ? words(step.actorRole) : "system"} <span className="font-mono">{step.actorId}</span></p>
      </li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">No history steps are available.</p>}</section>
    </>}
  </SellerPanel>;
}

function ManualQueue({ selected, select, subject }: { selected: string | null; select: (id: string) => void; subject: string | null }) {
  const auth = useAuth();
  const [view, setView] = useState<ManualQueueView>("REVIEW");
  const [page, setPage] = useState(0);
  const [form, setForm] = useState<ManualQueueForm>(emptyQueueForm);
  const [applied, setApplied] = useState<ManualPayoutFilters>({});
  const [formError, setFormError] = useState("");
  const filters = combineQueueFilters(view, applied, page);
  const result = useApiQuery({ queryKey: queryKeys.backoffice.manualPayouts(auth.sessionId, filters), meta: { requiresAuth: true },
    service: (signal) => getManualPayouts(filters, { context: auth.requestContext, signal }) }, { retry: false });
  return <>
    <div aria-label="Queue views" className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border text-sm">{manualQueueViews.map((entry) => <button key={entry.id} type="button" aria-pressed={view === entry.id} onClick={() => { setView(entry.id); setPage(0); }} className={`min-h-11 border-b-2 pb-3 ${view === entry.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{entry.label}</button>)}</div>
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); const parsed = parseQueueForm(form); if (!parsed.ok) { setFormError(parsed.error); return; } setFormError(""); setApplied(parsed.value); setPage(0); }}>
      <label className="grid gap-2 text-xs">Seller UUID<input className={sellerInput} value={form.sellerId} placeholder="All sellers" onChange={(event) => setForm((value) => ({ ...value, sellerId: event.target.value }))} /></label>
      <label className="grid gap-2 text-xs">From date<input type="date" className={sellerInput} value={form.from} max={form.to || undefined} onChange={(event) => setForm((value) => ({ ...value, from: event.target.value }))} /></label>
      <label className="grid gap-2 text-xs">To date<input type="date" className={sellerInput} value={form.to} min={form.from || undefined} onChange={(event) => setForm((value) => ({ ...value, to: event.target.value }))} /></label>
      <label className="grid gap-2 text-xs">Seller receipt<select className={sellerInput} value={form.receiptStatus} onChange={(event) => setForm((value) => ({ ...value, receiptStatus: event.target.value }))}><option value="">Any receipt state</option>{receiptStatuses.map((status) => <option key={status} value={status}>{receiptLabel(status)}</option>)}</select></label>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-2 text-xs sm:col-span-2 lg:col-span-4"><legend className="mb-2">Payout status (any of)</legend>{payoutStatuses.map((status) => <label key={status} className="flex min-h-8 items-center gap-2"><input type="checkbox" checked={form.statuses.includes(status)} onChange={(event) => setForm((value) => ({ ...value, statuses: event.target.checked ? [...value.statuses, status] : value.statuses.filter((entry) => entry !== status) }))} />{manualStatusLabel(status)}</label>)}</fieldset>
      <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-4"><button type="submit" className={sellerPrimary}>Apply filters</button><button type="button" className={sellerButton} onClick={() => { setForm(emptyQueueForm); setApplied({}); setPage(0); setFormError(""); }}>Reset filters</button></div>
      {formError && <p role="alert" className="text-sm text-danger sm:col-span-2 lg:col-span-4">{formError}</p>}
    </form>
    {view === "REVIEW" && <p className="text-xs text-muted-foreground">Needs review includes uncertain transfers, open staff exceptions and unresolved seller cases, also on succeeded payouts.</p>}
    {result.isPending ? <p role="status">Loading manual payouts…</p> : result.error ? <SellerPanel title="Manual payout queue unavailable"><p role="alert" className="text-sm text-danger">{manualPayoutErrorMessage(result.error)}</p><button type="button" className={`${sellerButton} mt-4`} onClick={() => void result.refetch()}>Retry queue</button></SellerPanel> : <>
      <ManualPayoutTable rows={result.data.content} subject={subject} selectedId={selected} select={select} />
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm"><p className="text-muted-foreground">Page {page + 1} · {result.data.totalElements} payouts</p><nav aria-label="Manual payout pagination" className="flex gap-2"><button type="button" className={sellerButton} disabled={page === 0 || result.isFetching} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" className={sellerButton} disabled={result.isFetching || page + 1 >= result.data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></nav></div>
    </>}
  </>;
}

function ManualWorkspace({ seller }: { seller: boolean }) {
  const auth = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [keys] = useState(() => new Map<string, PendingKey>());
  const capabilities = useApiQuery({ queryKey: queryKeys.backoffice.manualPayoutCapabilities(auth.sessionId), meta: { requiresAuth: true },
    service: (signal) => getManualPayoutCapabilities({ context: auth.requestContext, signal }) }, { retry: false });
  const subject = readBackofficeSubject(auth.accessToken);
  return <>
    <SellerHeading title="Manual payouts" description="Claim one payout, transfer it in the platform banking app, then record the completed transfer with evidence. One QR covers exactly one payout and its frozen net amount.">{seller && <Link className={sellerButton} href="/backoffice/payouts?view=seller">My payouts</Link>}</SellerHeading>
    {capabilities.isPending ? <p role="status">Checking manual payout availability…</p> : capabilities.error ? <SellerPanel title="Manual payouts unavailable"><p role="alert" className="text-sm text-danger">{manualPayoutErrorMessage(capabilities.error)}</p><button type="button" className={`${sellerButton} mt-4`} onClick={() => void capabilities.refetch()}>Check again</button></SellerPanel> : <>
      {capabilities.data.automaticJobsEnabled && <p role="status" className="rounded-sm border border-warning/30 bg-warning/10 p-4 text-sm">Automatic payout jobs are still enabled on the server, so new manual work is unavailable. Recovery of issued attempts stays available.</p>}
      {capabilities.data.executionMode === "AUTO" && <p role="status" className="rounded-sm border border-border p-4 text-sm">New payouts run automatically on this server. This workspace handles payouts created in manual mode.</p>}
      {!capabilities.data.enabled && <p role="status" className="rounded-sm border border-warning/30 bg-warning/10 p-4 text-sm">New claims and QR issuance are paused. You can still record or reconcile attempts that already have a QR.</p>}
      {!capabilities.data.canReconcile && <p className="text-xs text-muted-foreground">You can execute transfers you own. Reconciliation, corrections and retries are handled by an administrator.</p>}
      <ManualQueue selected={selected} select={setSelected} subject={subject} />
      {selected && <ManualPayoutDetailPanel key={`${auth.sessionId}:${selected}`} id={selected} capabilities={capabilities.data} keys={keys} subject={subject} close={() => setSelected(null)} />}
    </>}
  </>;
}

function ManualPayoutsPage() {
  const auth = useAuth();
  const roles = readBackofficeRoles(auth.accessToken);
  const staff = roles.includes("ADMIN") || roles.includes("SUPPORT_STAFF");
  if (auth.status !== "authenticated") return null;
  if (!staff) return <SellerPanel title="403 · Staff access required"><p className="text-sm text-muted-foreground">Manual payouts are available to administrators and support staff.</p></SellerPanel>;
  return <ManualWorkspace key={auth.sessionId} seller={roles.includes("SELLER")} />;
}

export default ManualPayoutsPage;
