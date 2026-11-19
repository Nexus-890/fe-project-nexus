"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { AdminPageHeader, adminInputClass } from "../components/AdminPrimitives";
import { OperationsError, OperationsTable, OperationsTabs, OperationTime, operationCell as cell, referenceClass } from "../components/SupportOperationsUi";
import { SellerPanel, SellerStatus, sellerButton, sellerPrimary } from "../components/SellerUi";
import { formatVND } from "../components/formatPrice";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { useApiQuery } from "../hooks/useApi";
import { completeOrderRefund, getOrderRefunds, getRefundEvidence, refundEvidenceError, requestOrderRefund, uploadRefundEvidence } from "../service/supportOperationsService";
import type { Refund, RefundEvidence, RefundEvidenceInput, RefundInput } from "../types/supportOperationsType";
import { MAX_REFUND_EVIDENCE_FILES } from "../types/supportOperationsType";
import { useAdminAction } from "./useAdminAction";
import { MoneyInput } from "../components/moneyInput";

const extension = (type: RefundEvidence["contentType"]) => type === "application/pdf" ? "pdf" : type === "image/png" ? "png" : "jpg";
const kind = (type: RefundEvidence["contentType"]) => type === "application/pdf" ? "PDF" : type === "image/png" ? "PNG" : "JPEG";

function RefundEvidenceFile({ refundId, file, index }: { refundId: string; file: RefundEvidence; index: number }) {
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
    getRefundEvidence(refundId, file.evidenceId, { context: auth.requestContext, signal: next.signal })
      .then((blob) => { if (next.signal.aborted) return; const link = URL.createObjectURL(blob); if (current.current) URL.revokeObjectURL(current.current); current.current = link; setUrl(link); })
      .catch(() => { if (!next.signal.aborted) setError("Unable to load this receipt. Try again."); })
      .finally(() => { if (!next.signal.aborted) setLoading(false); });
  };
  return <li className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border p-3 text-xs">
    <span className="min-w-0 break-all">Receipt {index + 1} · {kind(file.contentType)} · {Math.max(1, Math.round(file.sizeBytes / 1024))} KB · Bank reference <span className="font-mono">{file.bankReference}</span> · <OperationTime value={file.uploadedAt} /></span>
    {url ? <a className={sellerButton} href={url} download={`refund-receipt-${file.evidenceId.slice(0, 8)}.${extension(file.contentType)}`}>Save receipt {index + 1}</a> : <button type="button" className={sellerButton} disabled={loading} onClick={load}>{loading ? "Loading…" : `Open receipt ${index + 1}`}</button>}
    {error && <p role="alert" className="basis-full text-danger">{error}</p>}
  </li>;
}

function RefundTransferPanel({ refund, root, close, done }: { refund: Refund; root: QueryKey; close: () => void; done: () => void }) {
  const [file, setFile] = useState<File | null>(null); const [bankReference, setBankReference] = useState("");
  const [fileError, setFileError] = useState(""); const [picker, setPicker] = useState(0);
  const upload = useAdminAction((input: RefundEvidenceInput, options) => uploadRefundEvidence(refund.refundId, input, options), [root], () => { setFile(null); setBankReference(""); setPicker((value) => value + 1); });
  const complete = useAdminAction(completeOrderRefund, [root], done);
  const open = refund.status === "REQUESTED"; const hasEvidence = refund.evidence.length > 0;
  return <SellerPanel title={open ? "Confirm manual refund" : "Refund transfer receipts"}>
    {open ? <p className="text-sm">Transfer {formatVND(String(refund.amount))} to the buyer by bank, then upload the transfer receipt with its bank reference. The refund can be completed only after at least one receipt is attached.</p> : <p className="text-sm">This refund was completed. The receipts below were recorded as proof of the manual transfer.</p>}
    {hasEvidence ? <ul aria-label="Transfer receipts" className="mt-4 grid gap-2">{refund.evidence.map((item, index) => <RefundEvidenceFile key={item.evidenceId} refundId={refund.refundId} file={item} index={index} />)}</ul> : <p role="status" className="mt-4 rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">No transfer receipt uploaded yet.</p>}
    {open && refund.evidence.length < MAX_REFUND_EVIDENCE_FILES && <form className="mt-4 space-y-4" onSubmit={(event) => {
      event.preventDefault(); if (!file) { setFileError("Choose the transfer receipt file."); return; }
      const problem = refundEvidenceError(file, refund.evidence.length); setFileError(problem || ""); if (!problem) upload.run({ file, bankReference: bankReference.trim() });
    }}><fieldset disabled={upload.isPending} className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-xs">Bank transaction reference<input required maxLength={100} className={adminInputClass} value={bankReference} onChange={(event) => setBankReference(event.target.value)} /></label><label className="grid gap-2 text-xs">Transfer receipt (JPEG, PNG or PDF, up to 10 MiB)<input key={picker} type="file" required accept="image/jpeg,image/png,application/pdf" className={adminInputClass} onChange={(event) => { const next = event.target.files?.[0] || null; setFile(next); setFileError(next ? refundEvidenceError(next, refund.evidence.length) || "" : ""); }} /></label><button className={`${sellerButton} justify-self-start`}>{upload.isPending ? "Uploading…" : "Upload receipt"}</button></fieldset>{fileError && <p role="alert" className="text-sm text-danger">{fileError}</p>}<OperationsError error={upload.error} /></form>}
    {open ? <form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); complete.run(refund.refundId); }}><fieldset disabled={complete.isPending || !hasEvidence} className="space-y-4"><label className="flex items-start gap-3 text-sm"><input type="checkbox" required className="mt-1 size-4 accent-primary" />I verified that the buyer’s bank transfer succeeded.</label>{!hasEvidence && <p className="text-xs text-muted-foreground">Upload at least one transfer receipt before completing the refund.</p>}<div className="flex flex-wrap gap-3"><button className={sellerPrimary}>{complete.isPending ? "Confirming…" : "Complete refund"}</button><button type="button" className={sellerButton} onClick={close}>Cancel confirmation</button></div></fieldset><OperationsError error={complete.error} /></form>
      : <button type="button" className={`${sellerButton} mt-4`} onClick={close}>Close receipts</button>}
  </SellerPanel>;
}

function RefundWorkspace({ orderId }: { orderId: string }) {
  const auth = useAuth();
  const [reason, setReason] = useState(""); const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState(""); const [confirmId, setConfirmId] = useState<string | null>(null);
  const [keys] = useState(() => new Map<string, string>());
  const root = queryKeys.operations.root(auth.sessionId);
  const refunds = useApiQuery({ queryKey: queryKeys.operations.list(auth.sessionId, "refunds", { orderId }), meta: { requiresAuth: true }, service: (signal) => getOrderRefunds(orderId, { context: auth.requestContext, signal }) });
  const create = useAdminAction((input: { body: RefundInput; key: string }, options) => requestOrderRefund(input.body, input.key, options), [root], () => { setNotice("Refund recorded. Confirm completion only after the manual bank transfer has succeeded."); });
  const confirm = refunds.data?.find((refund: Refund) => refund.refundId === confirmId) ?? null;
  return <><p className={referenceClass}>Order {orderId}</p><OperationsError error={refunds.error} retry={() => void refunds.refetch()} />{notice && <p role="status" className="rounded-sm border border-success/30 bg-success/5 p-4 text-sm text-success">{notice}</p>}
    {refunds.isPending ? <p role="status">Loading refunds…</p> : !refunds.error && <>
      <OperationsTable headers={["Refund", "Amount", "Status", "Reason", "Requested / completed", "Action"]} empty={!refunds.data?.length}>{refunds.data?.map((refund) => <tr key={refund.refundId} className="border-t border-border"><td className={`${cell} ${referenceClass}`}>{refund.refundId}</td><td className={`${cell} whitespace-nowrap font-mono text-xs`}>{formatVND(String(refund.amount))}</td><td className={cell}><SellerStatus>{refund.status}</SellerStatus><p className="mt-2 text-xs text-muted-foreground">{refund.evidence.length ? `${refund.evidence.length} receipt${refund.evidence.length > 1 ? "s" : ""}` : "No receipt"}</p></td><td className={`${cell} max-w-64 break-words`}>{refund.reason}</td><td className={`${cell} text-xs`}><OperationTime value={refund.requestedAt} />{refund.completedAt && <p className="mt-2 text-success"><OperationTime value={refund.completedAt} /></p>}</td><td className={cell}>{refund.status === "REQUESTED" ? <button className={sellerButton} onClick={() => { setConfirmId(refund.refundId); setNotice(""); }}>Confirm refund transfer</button> : refund.evidence.length > 0 && <button className={sellerButton} onClick={() => { setConfirmId(refund.refundId); setNotice(""); }}>View transfer receipts</button>}</td></tr>)}</OperationsTable>
      {!refunds.data?.length && <SellerPanel title="Record a refund"><p className="mb-4 text-sm text-muted-foreground">Refunds require a canceled, funded order. Leave the amount blank to refund the full paid amount. The backend checks eligibility and prevents a second refund.</p><form className="space-y-4" onSubmit={(event) => {
        event.preventDefault(); setNotice(""); const body: RefundInput = { orderId, reason: reason.trim(), ...(amount ? { amount: Number(amount) } : {}) };
        const signature = JSON.stringify(body); const key = keys.get(signature) || crypto.randomUUID(); keys.set(signature, key); create.run({ body, key });
      }}><fieldset disabled={create.isPending} className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-xs">Refund amount (VND, optional)<MoneyInput className={adminInputClass} value={amount} onValueChange={setAmount} /></label><label className="grid gap-2 text-xs">Refund reason<textarea required maxLength={500} className={adminInputClass} value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className={`${sellerPrimary} justify-self-start`}>{create.isPending ? "Recording…" : create.isError ? "Retry refund request" : "Record refund"}</button></fieldset><OperationsError error={create.error} /></form></SellerPanel>}
    </>}
    {confirm && <RefundTransferPanel key={confirm.refundId} refund={confirm} root={root} close={() => setConfirmId(null)} done={() => { setConfirmId(null); setNotice("Refund completed. The manual transfer and its receipts have been recorded."); }} />}
  </>;
}

function SupportRefundsPage() {
  const auth = useAuth(); const params = useSearchParams();
  const [draft, setDraft] = useState(params.get("orderId") || ""); const [orderId, setOrderId] = useState(draft);
  return <><AdminPageHeader title="Refunds" description="Record refund requests, attach the bank transfer receipt and confirm completed manual transfers." /><OperationsTabs /><form className="flex flex-wrap items-end gap-3 rounded-sm border border-border bg-card p-4" onSubmit={(event) => { event.preventDefault(); setOrderId(draft.trim()); }}><label className="grid flex-1 gap-2 text-xs">Refund order UUID<input required className={adminInputClass} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Enter an order reference" /></label><button className={sellerPrimary}>Find order refunds</button></form>{orderId ? <RefundWorkspace key={`${auth.sessionId}:${orderId}`} orderId={orderId} /> : <p className="text-sm text-muted-foreground">Find an order to review or record its refund.</p>}</>;
}
export default SupportRefundsPage;
