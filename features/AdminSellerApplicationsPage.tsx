"use client";

import { useEffect, useRef, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { Button } from "../components/button";
import { AdminEmptyState, AdminError, AdminPageHeader, AdminPagination, adminSelectClass } from "../components/AdminPrimitives";
import SellerApplicationDecisionDialog from "../components/SellerApplicationDecisionDialog";
import { SELLER_APPLICATION_ENABLED } from "../configs/account";
import { queryKeys } from "../configs/queryKeys";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { approveSellerApplication, getAdminSellerApplications, rejectSellerApplication } from "../service/adminSellerApplicationService";
import { readBackofficeRoles } from "./backofficeAccess";
import type { AuthContextValue } from "../types/authType";
import type { AdminSellerApplicationFilters, SellerApplicationDecision } from "../types/adminSellerApplicationType";
import type { SellerApplication } from "../types/sellerApplicationType";

type DecisionOperation = { id: string; decision: SellerApplicationDecision; reason: string; sessionId: number; controller: AbortController };
const statusLabels: Record<SellerApplication["status"], string> = { PENDING: "Pending", ACTIVE: "Approved", REJECTED: "Rejected" };
const statusColors: Record<SellerApplication["status"], string> = { PENDING: "bg-warning/10 text-warning", ACTIVE: "bg-success/10 text-success", REJECTED: "bg-danger/10 text-danger" };

function SellerApplicationQueue({ auth }: { auth: AuthContextValue }) {
  const [status, setStatus] = useState<SellerApplication["status"] | "">("PENDING");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<{ application: SellerApplication; decision: SellerApplicationDecision } | null>(null);
  const [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const filters: AdminSellerApplicationFilters = { page, size: 10, ...(status ? { status } : {}) };
  const result = useApiQuery({
    queryKey: queryKeys.admin.sellerApplications(auth.sessionId, filters), meta: { requiresAuth: true },
    service: (signal) => getAdminSellerApplications(filters, { context: auth.requestContext, signal }),
  }, { retry: false });
  const mutation = useApiMutation<SellerApplication, DecisionOperation>({
    mutationKey: [...queryKeys.admin.root(auth.sessionId), "seller-application-decision"],
    execute: ({ id, decision, reason, controller }) => decision === "approve"
      ? approveSellerApplication(id, { context: auth.requestContext, signal: controller.signal })
      : rejectSellerApplication(id, { reason }, { context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey: [queryKeys.admin.root(auth.sessionId)],
  }, {
    onSuccess: (application) => {
      setSelected(null);
      setNotice(application.status === "ACTIVE" ? "Application approved. The buyer can sign in again to access the seller back office." : "Application rejected. The buyer can read your feedback and apply again.");
    },
    onError: (error, operation) => {
      if (error.status === 409 && auth.isSessionCurrent(operation.sessionId) && !operation.controller.signal.aborted) void result.refetch();
    },
    onSettled: (_data, _error, operation) => { if (pending.current === operation.controller) pending.current = null; },
  });
  const choose = (application: SellerApplication, decision: SellerApplicationDecision) => {
    mutation.reset(); setNotice(""); setSelected({ application, decision });
  };

  return <div className="space-y-6">
    <AdminPageHeader title="Seller applications" description="Review business details and approve or reject requests to sell on Nexus.">
      <Button variant="outline" disabled={result.isFetching || mutation.isPending} onClick={() => void result.refetch()} className="min-h-9 rounded-sm px-3"><RefreshCw className="size-4" aria-hidden="true" />Refresh</Button>
    </AdminPageHeader>
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-3 text-xs text-muted-foreground">Status<select aria-label="Status" className={adminSelectClass} value={status} disabled={mutation.isPending} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(0); }}><option value="">All statuses</option><option value="PENDING">Pending review</option><option value="ACTIVE">Approved</option><option value="REJECTED">Rejected</option></select></label><p className="text-xs text-muted-foreground">Only administrators can approve or reject applications.</p></div>
    {notice && <p role="status" className="rounded-sm border border-success/25 bg-success/5 p-4 text-sm text-success">{notice}</p>}
    {result.isPending ? <p role="status" className="rounded-sm border border-border p-8 text-sm text-muted-foreground">Loading seller applications…</p> : result.error ? <AdminError error={result.error} onRetry={() => void result.refetch()} /> : <>
      <div className="overflow-x-auto rounded-sm border border-border"><table className="w-full min-w-[800px] text-left text-sm"><caption className="sr-only">Seller applications</caption>
        <thead className="bg-muted text-xs text-muted-foreground"><tr>{["Company", "Contact phone", "Application note", "Status", "Review"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-normal">{label}</th>)}</tr></thead>
        <tbody>{result.data?.applications.map((application) => <tr key={application.id} className="border-t border-border align-top hover:bg-muted/30">
          <th scope="row" className="max-w-52 px-4 py-4 text-left font-medium"><span className="block break-words">{application.companyName}</span><span className="mt-1 block break-all font-mono text-[11px] font-normal text-muted-foreground">{application.id}</span></th>
          <td className="whitespace-nowrap px-4 py-4 font-mono text-xs">{application.phone}</td>
          <td className="max-w-96 px-4 py-4 text-xs leading-5"><p className="whitespace-pre-wrap break-words">{application.note}</p>{application.rejectionReason && <p className="mt-3 whitespace-pre-wrap break-words text-danger"><span className="font-medium">Rejection reason: </span>{application.rejectionReason}</p>}</td>
          <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2 py-1 text-xs ${statusColors[application.status]}`}>{statusLabels[application.status]}</span></td>
          <td className="px-4 py-4">{application.status === "PENDING" ? <div className="flex gap-2"><Button className="min-h-9 rounded-sm px-3 text-xs" disabled={mutation.isPending || result.isFetching} onClick={() => choose(application, "approve")}><Check className="size-3.5" aria-hidden="true" />Approve</Button><Button variant="outline" className="min-h-9 rounded-sm px-3 text-xs text-danger" disabled={mutation.isPending || result.isFetching} onClick={() => choose(application, "reject")}><X className="size-3.5" aria-hidden="true" />Reject</Button></div> : <span className="text-xs text-muted-foreground">Reviewed</span>}</td>
        </tr>)}</tbody>
      </table>{!result.data?.applications.length && <AdminEmptyState title="No applications found" description="Try another status or check back when a buyer applies." />}</div>
      <AdminPagination page={result.data?.page} onPageChange={setPage} />
    </>}
    {selected && <SellerApplicationDecisionDialog application={selected.application} decision={selected.decision} pending={mutation.isPending} error={mutation.error} onClose={() => { if (!mutation.isPending) setSelected(null); }}
      onConfirm={(reason) => {
        if (pending.current || !auth.isSessionCurrent(auth.sessionId)) return;
        const controller = new AbortController(); pending.current = controller;
        mutation.mutate({ id: selected.application.id, decision: selected.decision, reason, sessionId: auth.sessionId, controller });
      }} />}
  </div>;
}

function AdminSellerApplicationsPage() {
  const auth = useAuth();
  const admin = auth.status === "authenticated" && readBackofficeRoles(auth.accessToken).includes("ADMIN");
  if (!admin) return <AdminEmptyState title="Access denied" description="Only administrators can review seller applications." />;
  if (!SELLER_APPLICATION_ENABLED) return <div className="space-y-6"><AdminPageHeader title="Seller applications" description="Review business details and requests to sell on Nexus." /><AdminEmptyState title="Seller applications are not available yet" description="Please check back later." /></div>;
  return <SellerApplicationQueue key={auth.sessionId} auth={auth} />;
}

export default AdminSellerApplicationsPage;
