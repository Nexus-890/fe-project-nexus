"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AdminPageHeader, adminInputClass } from "../components/AdminPrimitives";
import { OperationsError, OperationsPagination, OperationsTable, OperationsTabs, OperationTime, operationCell as cell, referenceClass } from "../components/SupportOperationsUi";
import { sellerButton, sellerPrimary, SellerStatus } from "../components/SellerUi";
import { formatVND } from "../components/formatPrice";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getManagedPayments } from "../service/supportOperationsService";
import type { PaymentFilters } from "../types/supportOperationsType";

function SupportPaymentsPage() {
  const auth = useAuth(); const params = useSearchParams();
  const [orderId, setOrderId] = useState(params.get("orderId") || "");
  const [status, setStatus] = useState<PaymentFilters["status"] | "">(orderId ? "" : "UNRECONCILED");
  const [filters, setFilters] = useState<PaymentFilters>({ page: 0, size: 10, ...(orderId ? { orderId } : { status: "UNRECONCILED" }) });
  const payments = useApiQuery({ queryKey: queryKeys.operations.list(auth.sessionId, "payments", filters), meta: { requiresAuth: true }, service: (signal) => getManagedPayments(filters, { context: auth.requestContext, signal }) });
  return <><AdminPageHeader title="Payments" description="Review incoming transfers and payments requiring reconciliation." /><OperationsTabs /><form className="flex flex-wrap items-end gap-3 rounded-sm border border-border bg-card p-4" onSubmit={(event) => { event.preventDefault(); setFilters({ page: 0, size: 10, orderId: orderId.trim() || undefined, status: orderId.trim() ? undefined : status || undefined }); }}><label className="grid gap-2 text-xs">Payment order UUID<input className={adminInputClass} value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="All orders" /></label><label className="grid gap-2 text-xs">Payment status<select disabled={!!orderId.trim()} className={adminInputClass} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="">All statuses</option>{["UNRECONCILED", "PENDING", "SUCCESS", "FAILED"].map((s) => <option key={s}>{s}</option>)}</select></label><button className={sellerPrimary}>Apply payment filters</button><button type="button" className={sellerButton} onClick={() => { setOrderId(""); setStatus("UNRECONCILED"); setFilters({ page: 0, size: 10, status: "UNRECONCILED" }); }}>Unreconciled payments</button></form>{orderId.trim() && <p className="text-xs text-muted-foreground">An order lookup shows all its payment transactions.</p>}
    <OperationsError error={payments.error} retry={() => void payments.refetch()} />{payments.isPending ? <p role="status">Loading payments…</p> : !payments.error && <><OperationsTable headers={["Transaction / group", "Provider", "Amount", "Type", "Status", "Received"]} empty={!payments.data?.content.length}>{payments.data?.content.map((row) => <tr key={row.transactionId} className="border-t border-border"><td className={`${cell} ${referenceClass}`}><p>{row.transactionId}</p><p className="mt-2">Group {row.orderGroupId}</p></td><td className={`${cell} text-xs`}>{row.provider}<p className="mt-1 font-mono text-muted-foreground">{row.providerReference || "—"}</p></td><td className={`${cell} whitespace-nowrap font-mono text-xs`}>{formatVND(String(row.amount))}</td><td className={`${cell} text-xs`}>{row.type}</td><td className={cell}><SellerStatus>{row.status}</SellerStatus></td><td className={`${cell} text-xs`}><OperationTime value={row.receivedAt} /></td></tr>)}</OperationsTable>{!filters.orderId && <OperationsPagination result={payments.data} change={(page) => setFilters({ ...filters, page })} />}</>}
  </>;
}
export default SupportPaymentsPage;
