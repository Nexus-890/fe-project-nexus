"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AdminPageHeader, adminInputClass } from "../components/AdminPrimitives";
import { OperationsError, OperationsTable, OperationsTabs, OperationTime, operationCell as cell, referenceClass } from "../components/SupportOperationsUi";
import { SellerPanel, SellerStatus, sellerButton, sellerPrimary } from "../components/SellerUi";
import { formatVND } from "../components/formatPrice";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { useApiQuery } from "../hooks/useApi";
import { completeOrderRefund, getOrderRefunds, requestOrderRefund } from "../service/supportOperationsService";
import type { Refund, RefundInput } from "../types/supportOperationsType";
import { useAdminAction } from "./useAdminAction";
import { MoneyInput } from "../components/moneyInput";

function RefundWorkspace({ orderId }: { orderId: string }) {
  const auth = useAuth();
  const [reason, setReason] = useState(""); const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState(""); const [confirm, setConfirm] = useState<Refund | null>(null);
  const [keys] = useState(() => new Map<string, string>());
  const root = queryKeys.operations.root(auth.sessionId);
  const refunds = useApiQuery({ queryKey: queryKeys.operations.list(auth.sessionId, "refunds", { orderId }), meta: { requiresAuth: true }, service: (signal) => getOrderRefunds(orderId, { context: auth.requestContext, signal }) });
  const create = useAdminAction((input: { body: RefundInput; key: string }, options) => requestOrderRefund(input.body, input.key, options), [root], () => { setNotice("Refund recorded. Confirm completion only after the manual bank transfer has succeeded."); });
  const complete = useAdminAction(completeOrderRefund, [root], () => { setConfirm(null); setNotice("Refund completed. The manual transfer confirmation has been recorded."); });
  return <><p className={referenceClass}>Order {orderId}</p><OperationsError error={refunds.error} retry={() => void refunds.refetch()} />{notice && <p role="status" className="rounded-sm border border-success/30 bg-success/5 p-4 text-sm text-success">{notice}</p>}
    {refunds.isPending ? <p role="status">Loading refunds…</p> : !refunds.error && <>
      <OperationsTable headers={["Refund", "Amount", "Status", "Reason", "Requested / completed", "Action"]} empty={!refunds.data?.length}>{refunds.data?.map((refund) => <tr key={refund.refundId} className="border-t border-border"><td className={`${cell} ${referenceClass}`}>{refund.refundId}</td><td className={`${cell} whitespace-nowrap font-mono text-xs`}>{formatVND(String(refund.amount))}</td><td className={cell}><SellerStatus>{refund.status}</SellerStatus></td><td className={`${cell} max-w-64 break-words`}>{refund.reason}</td><td className={`${cell} text-xs`}><OperationTime value={refund.requestedAt} />{refund.completedAt && <p className="mt-2 text-success"><OperationTime value={refund.completedAt} /></p>}</td><td className={cell}>{refund.status === "REQUESTED" && <button className={sellerButton} onClick={() => { complete.reset(); setConfirm(refund); setNotice(""); }}>Confirm refund transfer</button>}</td></tr>)}</OperationsTable>
      {!refunds.data?.length && <SellerPanel title="Record a refund"><p className="mb-4 text-sm text-muted-foreground">Refunds require a canceled, funded order. Leave the amount blank to refund the full paid amount. The backend checks eligibility and prevents a second refund.</p><form className="space-y-4" onSubmit={(event) => {
        event.preventDefault(); setNotice(""); const body: RefundInput = { orderId, reason: reason.trim(), ...(amount ? { amount: Number(amount) } : {}) };
        const signature = JSON.stringify(body); const key = keys.get(signature) || crypto.randomUUID(); keys.set(signature, key); create.run({ body, key });
      }}><fieldset disabled={create.isPending} className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-xs">Refund amount (VND, optional)<MoneyInput className={adminInputClass} value={amount} onValueChange={setAmount} /></label><label className="grid gap-2 text-xs">Refund reason<textarea required maxLength={500} className={adminInputClass} value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className={`${sellerPrimary} justify-self-start`}>{create.isPending ? "Recording…" : create.isError ? "Retry refund request" : "Record refund"}</button></fieldset><OperationsError error={create.error} /></form></SellerPanel>}
    </>}
    {confirm && <SellerPanel title="Confirm manual refund"><p className="text-sm">Confirm that {formatVND(String(confirm.amount))} has been transferred to the buyer. This records the transfer as completed.</p><form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); complete.run(confirm.refundId); }}><fieldset disabled={complete.isPending} className="space-y-4"><label className="flex items-start gap-3 text-sm"><input type="checkbox" required className="mt-1 size-4 accent-primary" />I verified that the buyer’s bank transfer succeeded.</label><div className="flex flex-wrap gap-3"><button className={sellerPrimary}>{complete.isPending ? "Confirming…" : "Complete refund"}</button><button type="button" className={sellerButton} onClick={() => setConfirm(null)}>Cancel confirmation</button></div></fieldset><OperationsError error={complete.error} /></form></SellerPanel>}
  </>;
}

function SupportRefundsPage() {
  const auth = useAuth(); const params = useSearchParams();
  const [draft, setDraft] = useState(params.get("orderId") || ""); const [orderId, setOrderId] = useState(draft);
  return <><AdminPageHeader title="Refunds" description="Record refund requests and confirm completed manual transfers." /><OperationsTabs /><form className="flex flex-wrap items-end gap-3 rounded-sm border border-border bg-card p-4" onSubmit={(event) => { event.preventDefault(); setOrderId(draft.trim()); }}><label className="grid flex-1 gap-2 text-xs">Refund order UUID<input required className={adminInputClass} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Enter an order reference" /></label><button className={sellerPrimary}>Find order refunds</button></form>{orderId ? <RefundWorkspace key={`${auth.sessionId}:${orderId}`} orderId={orderId} /> : <p className="text-sm text-muted-foreground">Find an order to review or record its refund.</p>}</>;
}
export default SupportRefundsPage;
