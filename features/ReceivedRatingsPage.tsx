"use client";

import { useState, type FormEvent } from "react";
import { AdminEmptyState, AdminError, AdminPagination, adminInputClass } from "../components/AdminPrimitives";
import { Button } from "../components/button";
import { queryKeys } from "../configs/queryKeys";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { createRatingDispute, getReceivedRatings } from "../service/ratingModerationService";
import type { Rating } from "../types/ratingType";

function ReceivedRatingsContent() {
  const auth = useAuth();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Rating | null>(null);
  const [submitted, setSubmitted] = useState<string[]>([]);
  const rows = useApiQuery({ queryKey: queryKeys.reputation.received(auth.sessionId, auth.user?.id ?? "", page), meta: { requiresAuth: true },
    service: (signal) => getReceivedRatings(auth.user?.id ?? "", page, { context: auth.requestContext, signal }) }, { enabled: auth.status === "authenticated" && Boolean(auth.user), retry: false });
  const mutation = useApiMutation({
    execute: async (input: { ratingId: string; reason: string }) => createRatingDispute(input.ratingId, { reason: input.reason }, { context: auth.requestContext }),
    isCurrent: () => auth.isSessionCurrent(auth.sessionId),
  }, { onSuccess: (_, input) => { setSubmitted((ids) => [...ids, input.ratingId]); setSelected(null); } });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selected && !mutation.isPending) mutation.mutate({ ratingId: selected.id, reason: String(new FormData(event.currentTarget).get("reason") ?? "").trim() });
  };
  return <div className="space-y-5 pb-10"><h1 className="text-heading-32">Ratings received</h1><p className="text-sm text-muted-foreground">If a rating you received is incorrect, explain why and ask our team to review it.</p>
    {submitted.length > 0 && <p role="status" className="text-sm text-success">Your dispute was submitted for review.</p>}
    {selected && <form key={selected.id} className="space-y-3 rounded-sm border border-border bg-muted p-4" aria-label="Dispute a rating" onSubmit={submit}>
      <h2 className="font-semibold">Dispute rating {selected.score}/5</h2><p className="whitespace-pre-wrap break-words text-sm">{selected.comment || "No rating comment"}</p>
      <label className="grid gap-1 text-sm">Dispute reason<textarea name="reason" required maxLength={1000} rows={4} className={adminInputClass} disabled={mutation.isPending} /></label><AdminError error={mutation.error} />
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Submitting…" : "Submit dispute"}</Button><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => { setSelected(null); mutation.reset(); }}>Cancel dispute</Button></div>
    </form>}
    {rows.isPending ? <p role="status">Loading ratings received…</p> : rows.error ? <AdminError error={rows.error} onRetry={() => void rows.refetch()} /> : rows.data && <>
      {!rows.data.items.length ? <AdminEmptyState title="No ratings received yet" /> : <ul className="space-y-3">{rows.data.items.map((row) => <li key={row.id} className="space-y-3 rounded-sm border border-border p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{row.score}/5 · {row.raterName}</p><time className="text-xs text-muted-foreground" dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleDateString()}</time></div>
        <p className="whitespace-pre-wrap break-words">{row.comment || "No comment"}</p>
        {row.disputeStatus && <p className="text-xs text-muted-foreground">Dispute status: {row.disputeStatus}</p>}
        {!row.ratedByMe && <Button variant="outline" disabled={mutation.isPending || submitted.includes(row.id) || Boolean(row.disputeStatus)} onClick={() => { setSelected(row); mutation.reset(); }}>{submitted.includes(row.id) || row.disputeStatus ? "Dispute submitted" : "Dispute rating"}</Button>}
      </li>)}</ul>}<AdminPagination page={rows.data.page} onPageChange={(number) => { setPage(number); setSelected(null); }} />
    </>}
  </div>;
}

function ReceivedRatingsPage() {
  const auth = useAuth();
  return <ReceivedRatingsContent key={auth.sessionId} />;
}

export default ReceivedRatingsPage;
