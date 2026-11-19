"use client";

import { useState, type FormEvent } from "react";
import { AdminEmptyState, AdminError, AdminPageHeader, AdminPagination, adminInputClass, adminSelectClass } from "../components/AdminPrimitives";
import { Button } from "../components/button";
import ReputationRestrictionList from "../components/ReputationRestrictionList";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery, useApiMutation } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getAdminUsers } from "../service/adminUserService";
import { createReputationRestriction, getReputationRestrictions, revokeReputationRestriction } from "../service/ratingModerationService";
import type { UserResponse } from "../types/authResponseType";
import type { ReputationRestriction } from "../types/ratingModerationType";
import { readBackofficeRoles } from "./backofficeAccess";
import SellerReputation from "./SellerReputation";

function UserRestrictions({ user }: { user: UserResponse }) {
  const auth = useAuth();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ReputationRestriction | null>(null);
  const [feedback, setFeedback] = useState("");
  const [validation, setValidation] = useState("");
  const rows = useApiQuery({ queryKey: queryKeys.reputation.restrictions(auth.sessionId, user.id, page), meta: { requiresAuth: true },
    service: (signal) => getReputationRestrictions(user.id, page, { context: auth.requestContext, signal }) });
  const mutation = useApiMutation({
    execute: async (input: { action: "create"; kind: "BID" | "SELL"; reason: string; until: string } | { action: "revoke"; id: string; reason: string }) => input.action === "create"
      ? createReputationRestriction(user.id, { action: input.kind, reason: input.reason, restrictedUntil: input.until }, { context: auth.requestContext })
      : revokeReputationRestriction(user.id, input.id, input.reason, { context: auth.requestContext }),
    isCurrent: () => auth.isSessionCurrent(auth.sessionId), invalidateKey: [queryKeys.reputation.all(auth.sessionId)],
  }, { onSuccess: (_, input) => { setSelected(null); setFeedback(input.action === "create" ? "Restriction added." : "Restriction removed."); setValidation(""); } });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mutation.isPending) return;
    const data = new FormData(event.currentTarget);
    const reason = String(data.get("reason") ?? "").trim();
    if (!reason || reason.length > 1000) { setValidation("Enter a reason of 1–1000 characters."); return; }
    if (selected) { mutation.mutate({ action: "revoke", id: selected.id, reason }); return; }
    const until = new Date(String(data.get("until") ?? ""));
    if (!Number.isFinite(until.getTime()) || until.getTime() <= Date.now()) { setValidation("Choose a future end time."); return; }
    setFeedback(""); setValidation("");
    mutation.mutate({ action: "create", kind: data.get("kind") === "SELL" ? "SELL" : "BID", reason, until: until.toISOString() });
  };
  return <section className="space-y-5 rounded-sm border border-border p-4 sm:p-6" aria-label="User reputation management">
    <h2 className="text-lg font-semibold">{user.fullName}</h2><SellerReputation sellerId={user.id} title="Transaction summary" />
    <form key={selected?.id ?? "create"} onSubmit={submit} className="space-y-3 rounded-sm bg-muted p-4">
      <h3 className="font-medium">{selected ? "Remove action restriction" : "Add action restriction"}</h3>
      {!selected && <div className="flex flex-wrap gap-3"><label className="grid gap-1 text-sm">Action<select name="kind" className={adminSelectClass}><option value="BID">Bidding</option><option value="SELL">Selling / publishing listings</option></select></label>
        <label className="grid gap-1 text-sm">Restricted until (your local time)<input type="datetime-local" name="until" required className={adminInputClass} /></label></div>}
      <label className="grid gap-1 text-sm">{selected ? "Removal reason" : "Restriction reason"}<textarea name="reason" required maxLength={1000} rows={3} className={adminInputClass} disabled={mutation.isPending} /></label>
      {validation && <p role="alert" className="text-sm text-danger">{validation}</p>}<AdminError error={mutation.error} />
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : selected ? "Confirm removal" : "Add restriction"}</Button>{selected && <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => { setSelected(null); setValidation(""); mutation.reset(); }}>Cancel removal</Button>}</div>
    </form>
    {feedback && <p role="status" className="text-sm text-success">{feedback}</p>}
    {rows.isPending ? <p role="status">Loading restrictions…</p> : rows.error ? <AdminError error={rows.error} onRetry={() => void rows.refetch()} /> : rows.data && <><ReputationRestrictionList items={rows.data.items} revoke={(item) => { if (!mutation.isPending) { setSelected(item); setValidation(""); setFeedback(""); mutation.reset(); } }} /><AdminPagination page={rows.data.page} onPageChange={setPage} /></>}
  </section>;
}

function AdminReputationsContent() {
  const auth = useAuth();
  const roles = readBackofficeRoles(auth.accessToken);
  const allowed = roles.includes("ADMIN");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UserResponse | null>(null);
  const [page, setPage] = useState(0);
  const filters = { q: search, role: "", status: "", page, size: 10, sort: "fullName" as const, direction: "asc" as const };
  const users = useApiQuery({ queryKey: queryKeys.admin.users(auth.sessionId, filters), meta: { requiresAuth: true },
    service: (signal) => getAdminUsers(filters, { context: auth.requestContext, signal }) }, { enabled: allowed && auth.status === "authenticated" });
  if (!allowed) return <AdminEmptyState title="Reputation management is restricted" />;
  return <div className="space-y-5"><AdminPageHeader title="Reputations" description="Review transactions and manage temporary action restrictions." />
    <form onSubmit={(event) => { event.preventDefault(); setSearch(String(new FormData(event.currentTarget).get("search") ?? "").trim()); setPage(0); }} className="flex flex-wrap items-end gap-3">
      <label className="grid min-w-0 flex-1 gap-1 text-sm">Find user<input name="search" placeholder="Name or email" className={adminInputClass} /></label><Button type="submit">Search users</Button></form>
    {users.isPending ? <p role="status">Loading users…</p> : users.error ? <AdminError error={users.error} onRetry={() => void users.refetch()} /> : users.data && <>
      <ul className="divide-y divide-border rounded-sm border border-border">{users.data.users.map((user) => <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0 text-sm"><p className="break-words font-medium">{user.fullName}</p><p className="break-all text-xs text-muted-foreground">{user.email}</p></div><Button variant={selected?.id === user.id ? "secondary" : "outline"} onClick={() => setSelected(user)}>Manage reputation<span className="sr-only"> for {user.fullName}</span></Button></li>)}</ul>
      {!users.data.users.length && <AdminEmptyState title="No users found" />}<AdminPagination page={users.data.page} onPageChange={setPage} /></>}
    {selected && <UserRestrictions key={`${auth.sessionId}:${selected.id}`} user={selected} />}
  </div>;
}

function AdminReputationsPage() {
  const auth = useAuth();
  return <AdminReputationsContent key={auth.sessionId} />;
}

export default AdminReputationsPage;
