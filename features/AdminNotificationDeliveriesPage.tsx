"use client";

import { useState } from "react";
import { Button } from "../components/button";
import { AdminEmptyState, AdminError, AdminPageHeader, AdminPagination, adminInputClass, adminSelectClass } from "../components/AdminPrimitives";
import { AdminLogField, formatLogTime, logFormText } from "../components/AdminLogTools";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getNotificationDeliveries, getNotificationDelivery } from "../service/notificationSettingsService";
import { deliveryChannels, deliveryStatuses, type NotificationDeliveryFilters } from "../types/notificationSettingsType";
import { readBackofficeRoles } from "./backofficeAccess";

function DeliveryDetail({ id, close }: { id: string; close: () => void }) {
  const auth = useAuth();
  const result = useApiQuery({ queryKey: queryKeys.notification.delivery(auth.sessionId, id), meta: { requiresAuth: true },
    service: (signal) => getNotificationDelivery(id, { context: auth.requestContext, signal }) });
  return <section aria-label="Delivery detail" className="space-y-4 rounded-sm border border-border p-4 sm:p-6">
    <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Delivery detail</h2><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{id}</p></div><Button variant="outline" onClick={close}>Close detail</Button></div>
    {result.isPending ? <p role="status">Loading delivery attempts…</p> : result.error ? <AdminError error={result.error} onRetry={() => void result.refetch()} /> : result.data && <>
      <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">{[
        ["Notification", result.data.title], ["User", result.data.userId], ["Status", result.data.status], ["Channel", result.data.channel],
        ["Attempts", result.data.attemptCount], ["Next attempt", result.data.nextAttemptAt ? formatLogTime(result.data.nextAttemptAt) : "None"],
        ["Last error", result.data.lastErrorCode || "None"], ["Updated (UTC+7)", formatLogTime(result.data.updatedAt)],
      ].map(([name, value]) => <div key={name}><dt className="text-xs text-muted-foreground">{name}</dt><dd className="mt-1 break-all">{value}</dd></div>)}</dl>
      {result.data.attempts.length ? <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-xs"><caption className="sr-only">Delivery attempts</caption><thead className="bg-muted text-muted-foreground"><tr>{["Attempt", "Status", "Started (UTC+7)", "Completed (UTC+7)", "Error", "Retryable"].map((heading) => <th scope="col" key={heading} className="px-3 py-3 font-normal">{heading}</th>)}</tr></thead><tbody>{result.data.attempts.map((attempt) => <tr key={attempt.id} className="border-t border-border">
        <th scope="row" className="px-3 py-3 font-normal">{attempt.attemptNumber}</th><td className="px-3 py-3">{attempt.status}</td><td className="whitespace-nowrap px-3 py-3">{formatLogTime(attempt.attemptedAt)}</td><td className="whitespace-nowrap px-3 py-3">{attempt.completedAt ? formatLogTime(attempt.completedAt) : "In progress"}</td><td className="break-all px-3 py-3">{attempt.errorCode || "—"}</td><td className="px-3 py-3">{attempt.retryable ? "Yes" : "No"}</td>
      </tr>)}</tbody></table></div> : <p role="status" className="text-sm text-muted-foreground">No delivery attempts have been recorded.</p>}
    </>}
  </section>;
}

function AdminNotificationDeliveriesPage() {
  const auth = useAuth();
  const authorized = readBackofficeRoles(auth.accessToken).includes("ADMIN");
  const [filters, setFilters] = useState<NotificationDeliveryFilters>({ page: 0, size: 20 });
  const [filterError, setFilterError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const deliveries = useApiQuery({ queryKey: queryKeys.notification.deliveries(auth.sessionId, filters), meta: { requiresAuth: true },
    service: (signal) => getNotificationDeliveries(filters, { context: auth.requestContext, signal }) }, { enabled: authorized });
  if (!authorized) return <AdminEmptyState title="Administrator access required" description="Only administrators can inspect notification deliveries." />;
  return <section aria-label="Notification deliveries" className="min-w-0 space-y-6">
    <AdminPageHeader title="Notification deliveries" description="Inspect delivery status, retry schedules and individual attempts."><Button variant="outline" disabled={deliveries.isFetching} onClick={() => void deliveries.refetch()}>Refresh deliveries</Button></AdminPageHeader>
    <form onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      const rawFrom = logFormText(form, "from"), rawTo = logFormText(form, "to");
      const from = rawFrom ? new Date(rawFrom).toISOString() : undefined, to = rawTo ? new Date(rawTo).toISOString() : undefined;
      if (from && to && from >= to) { setFilterError("Start time must be before end time."); return; }
      setFilterError(""); setSelected(null);
      setFilters({ page: 0, size: 20, status: logFormText(form, "status") as NotificationDeliveryFilters["status"],
        channel: logFormText(form, "channel") as NotificationDeliveryFilters["channel"], from, to, errorCode: logFormText(form, "errorCode") });
    }} onReset={() => { setFilters({ page: 0, size: 20 }); setSelected(null); setFilterError(""); }} className="space-y-4">
      <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-2 text-xs">Status<select name="status" className={adminSelectClass}><option value="">All statuses</option>{deliveryStatuses.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="grid gap-2 text-xs">Channel<select name="channel" className={adminSelectClass}><option value="">All channels</option>{deliveryChannels.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="grid gap-2 text-xs">Error code<input name="errorCode" maxLength={60} pattern="[A-Z0-9_]{1,60}" className={adminInputClass} placeholder="Exact error code" /></label>
        <AdminLogField name="from" label="Created from (local time)" type="datetime-local" />
        <AdminLogField name="to" label="Created to (local time)" type="datetime-local" />
        <div className="flex gap-2"><Button type="submit">Apply filters</Button><Button type="reset" variant="outline">Reset</Button></div>
      </div>
      {filterError && <p role="alert" className="text-sm text-danger">{filterError}</p>}
    </form>
    {deliveries.isPending ? <p role="status">Loading deliveries…</p> : deliveries.error ? <AdminError error={deliveries.error} onRetry={() => void deliveries.refetch()} /> : deliveries.data && <>
      {deliveries.data.items.length ? <div className="overflow-x-auto rounded-sm border border-border"><table className="w-full min-w-[900px] text-left text-xs"><caption className="sr-only">Notification delivery results</caption><thead className="bg-muted text-muted-foreground"><tr>{["Notification", "User", "Channel", "Status", "Attempts", "Next attempt (UTC+7)", "Last error", "Detail"].map((heading) => <th scope="col" key={heading} className="px-4 py-3 font-normal">{heading}</th>)}</tr></thead><tbody>{deliveries.data.items.map((row) => <tr key={row.id} className="border-t border-border">
        <th scope="row" className="max-w-64 break-words px-4 py-4 font-normal"><span className="block text-sm">{row.title}</span><span className="mt-1 block text-muted-foreground">{row.type}</span><time className="mt-1 block" dateTime={row.createdAt}>{formatLogTime(row.createdAt)}</time></th>
        <td className="max-w-40 break-all px-4 py-4 font-mono">{row.userId}</td><td className="px-4 py-4">{row.channel}</td><td className="px-4 py-4">{row.status}</td><td className="px-4 py-4">{row.attemptCount}</td><td className="whitespace-nowrap px-4 py-4">{row.nextAttemptAt ? formatLogTime(row.nextAttemptAt) : "—"}</td><td className="max-w-40 break-all px-4 py-4">{row.lastErrorCode || "—"}</td><td className="px-4 py-4"><Button variant="outline" onClick={() => setSelected(row.id)} aria-label={`View attempts for ${row.title}`}>View attempts</Button></td>
      </tr>)}</tbody></table></div> : <AdminEmptyState title="No deliveries found" description="Try another status, channel or date range." />}
      <AdminPagination page={deliveries.data.page} onPageChange={(page) => { setFilters({ ...filters, page }); setSelected(null); }} />
    </>}
    {selected && <DeliveryDetail key={selected} id={selected} close={() => setSelected(null)} />}
  </section>;
}
export default AdminNotificationDeliveriesPage;
