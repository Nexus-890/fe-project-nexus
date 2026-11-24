"use client";

import { useState, type FormEvent } from "react";
import { AdminEmptyState, AdminError, AdminPageHeader, AdminPagination, adminInputClass, adminSelectClass } from "../components/AdminPrimitives";
import { Button } from "../components/button";
import { queryKeys } from "../configs/queryKeys";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getRatingDisputes, resolveRatingDispute } from "../service/ratingModerationService";
import type { RatingDispute, ResolveDisputeRequest } from "../types/ratingModerationType";
import { readBackofficeRoles } from "./backofficeAccess";

function AdminRatingDisputesContent() {
  const auth = useAuth();
  const roles = readBackofficeRoles(auth.accessToken);
  const canResolve = roles.includes("ADMIN");
  const allowed = canResolve || roles.includes("SUPPORT_STAFF");
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<RatingDispute | null>(null);
  const [feedback, setFeedback] = useState("");
  const rows = useApiQuery({ queryKey: queryKeys.reputation.disputes(auth.sessionId, status, page), meta: { requiresAuth: true },
    service: (signal) => getRatingDisputes(status, page, { context: auth.requestContext, signal }) }, { enabled: allowed && auth.status === "authenticated" });
  const mutation = useApiMutation({
    execute: async (input: { id: string; body: ResolveDisputeRequest }) => resolveRatingDispute(input.id, input.body, { context: auth.requestContext }),
    isCurrent: () => auth.isSessionCurrent(auth.sessionId), invalidateKey: [queryKeys.reputation.all(auth.sessionId)],
  }, { onSuccess: (_, input) => { setSelected(null); setFeedback(input.body.status === "APPROVED" ? "Dispute approved. The rating is hidden and its impact on reputation has been removed." : "Dispute rejected. The rating remains visible."); } });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || mutation.isPending) return;
    const data = new FormData(event.currentTarget);
    mutation.mutate({ id: selected.id, body: { status: data.get("decision") === "APPROVED" ? "APPROVED" : "REJECTED", reason: String(data.get("reason") ?? "").trim() } });
  };
  if (!allowed) return <AdminEmptyState title="Rating dispute management is restricted" />;
  return <div className="space-y-5"><AdminPageHeader title="Rating disputes" description={canResolve ? "Review disputed ratings. Approved disputes remove the rating from reputation calculations." : "View disputed ratings and their decisions. Only administrators can resolve disputes."} />
    <label className="inline-grid gap-1 text-sm">Dispute status<select className={adminSelectClass} value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); setSelected(null); mutation.reset(); }}><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="">All statuses</option></select></label>
    {feedback && <p role="status" className="text-sm text-success">{feedback}</p>}
    {canResolve && selected && <form key={selected.id} onSubmit={submit} className="space-y-3 rounded-sm border border-border bg-muted p-4" aria-label="Resolve rating dispute">
      <h2 className="font-semibold">Review dispute</h2><p className="whitespace-pre-wrap break-words text-sm">{selected.reason}</p>
      <label className="grid gap-1 text-sm">Decision<select name="decision" className={adminSelectClass} disabled={mutation.isPending}><option value="REJECTED">Reject and keep rating</option><option value="APPROVED">Approve and hide rating</option></select></label>
      <label className="grid gap-1 text-sm">Decision reason<textarea name="reason" required maxLength={1000} rows={3} className={adminInputClass} disabled={mutation.isPending} /></label>
      <AdminError error={mutation.error} /><div className="flex gap-2"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving decision…" : "Save decision"}</Button><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => { setSelected(null); mutation.reset(); }}>Cancel review</Button></div>
    </form>}
    {rows.isPending ? <p role="status">Loading rating disputes…</p> : rows.error ? <AdminError error={rows.error} onRetry={() => void rows.refetch()} /> : rows.data && <>
      {!rows.data.items.length ? <AdminEmptyState title="No rating disputes" /> : <ul className="space-y-4">{rows.data.items.map((row) => <li key={row.id} className="space-y-3 rounded-sm border border-border p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">Rating: {row.ratingScore}/5</p><span className="rounded-sm bg-muted px-2 py-1 text-xs">{row.status}</span></div>
        <p className="whitespace-pre-wrap break-words text-muted-foreground">{row.ratingComment || "No rating comment"}</p><p className="whitespace-pre-wrap break-words"><strong>Dispute reason:</strong> {row.reason}</p>
        <p className="text-xs text-muted-foreground">Submitted <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString()}</time></p>
        {row.resolutionReason && <p className="whitespace-pre-wrap break-words"><strong>Decision reason:</strong> {row.resolutionReason}</p>}
        {canResolve && row.status === "PENDING" && <Button variant="outline" disabled={mutation.isPending} onClick={() => { setSelected(row); mutation.reset(); setFeedback(""); }}>Review dispute<span className="sr-only"> {row.id}</span></Button>}
      </li>)}</ul>}<AdminPagination page={rows.data.page} onPageChange={(number) => { setPage(number); setSelected(null); }} />
    </>}
  </div>;
}

function AdminRatingDisputesPage() {
  const auth = useAuth();
  return <AdminRatingDisputesContent key={auth.sessionId} />;
}

export default AdminRatingDisputesPage;
