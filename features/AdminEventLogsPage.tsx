"use client";

import { useState, type FormEvent } from "react";
import { Download, Search, X } from "lucide-react";
import { Button } from "../components/button";
import { AdminEmptyState, AdminError, AdminPageHeader, AdminPagination, adminInputClass, adminSelectClass } from "../components/AdminPrimitives";
import { AdminLogField, downloadAdminLog, formatLogTime, logFormText, logFormTime } from "../components/AdminLogTools";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getEventLogDetail, getEventLogs } from "../service/adminObservabilityService";
import type { EventLogFilters } from "../types/adminObservabilityType";
import { readBackofficeRoles } from "./backofficeAccess";

function EventDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const auth = useAuth();
  const [view, setView] = useState<"payload" | "envelope" | "raw">("payload");
  const detail = useApiQuery({
    queryKey: queryKeys.admin.event(auth.sessionId, id),
    service: (signal) => getEventLogDetail(id, { context: auth.requestContext, signal }),
    meta: { requiresAuth: true },
  }, { enabled: auth.status === "authenticated" });
  const data = detail.data;
  return <aside aria-label="Event details" className="min-w-0 self-start rounded-sm border border-border bg-card p-6 shadow-sm lg:sticky lg:top-6">
    <div className="mb-6 flex items-start justify-between gap-3">
      <h2 className="break-all text-base font-semibold">{data?.event.eventType ?? "Event details"}</h2>
      <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close event details"><X size={16} /></Button>
    </div>
    {detail.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading event details…</p> : detail.error ? <AdminError error={detail.error} onRetry={() => void detail.refetch()} /> : data && <>
      <dl className="space-y-4 text-xs">
        {[
          ["Event ID", data.event.eventId], ["Topic", data.event.topic || "—"],
          ["Trace ID", data.event.traceId], ["Entity", `${data.event.aggregateType || ""} ${data.event.aggregateId}`.trim()],
          ["Operator", data.event.operatorId || "System"], ["Occurred (UTC+7)", formatLogTime(data.event.occurredAt)],
          ["Received (UTC+7)", formatLogTime(data.event.receivedAt)],
        ].map(([label, value]) => <div key={label} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="break-all text-right font-mono">{value}</dd></div>)}
      </dl>
      <div className="mt-6 flex flex-wrap gap-2" aria-label="Event data view">
        {(["payload", "envelope", "raw"] as const).map((item) => <Button key={item} variant={view === item ? "secondary" : "ghost"} size="sm" aria-pressed={view === item} onClick={() => setView(item)}>{item === "raw" ? "Original JSON" : item === "payload" ? "Payload" : "Full envelope"}</Button>)}
      </div>
      <pre tabIndex={0} aria-label={view === "payload" ? "Event payload" : view === "raw" ? "Original event JSON" : "Full event envelope"} className="mt-3 max-h-[38rem] overflow-auto whitespace-pre-wrap break-all rounded-sm border border-border bg-muted p-4 font-mono text-xs leading-6">{view === "raw" ? data.rawEnvelope ?? "Original JSON was not recorded for this historical event." : JSON.stringify(view === "payload" ? data.payload : data.envelope, null, 2)}</pre>
    </>}
  </aside>;
}

function AdminEventLogsPage() {
  const auth = useAuth();
  const roles = readBackofficeRoles(auth.accessToken);
  const allowed = roles.includes("ADMIN") || roles.includes("SUPPORT_STAFF");
  const [filters, setFilters] = useState<EventLogFilters>({ page: 0, size: 20, sort: "occurredAt,desc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterError, setFilterError] = useState("");
  const logs = useApiQuery({
    queryKey: queryKeys.admin.events(auth.sessionId, filters),
    service: (signal) => getEventLogs(filters, { context: auth.requestContext, signal }),
    meta: { requiresAuth: true },
  }, { enabled: auth.status === "authenticated" && allowed });

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const from = logFormTime(form, "from");
    const to = logFormTime(form, "to");
    if (from && to && from > to) { setFilterError("Start time must be before or equal to end time."); return; }
    setFilterError("");
    const sort = logFormText(form, "sort") as EventLogFilters["sort"];
    setFilters({ q: logFormText(form, "q"), eventType: logFormText(form, "eventType"), aggregateType: logFormText(form, "aggregateType"), aggregateId: logFormText(form, "aggregateId"), operatorId: logFormText(form, "operatorId"), from, to, sort, page: 0, size: 20 });
    setSelectedId(null);
  };

  if (!allowed) return <AdminEmptyState title="Event log access required" description="Only administrators and support staff can view event logs." />;
  return <section aria-label="Event logs" className="min-w-0 space-y-6">
    <AdminPageHeader title="Event Logs" description="Every published event is captured automatically · newest first">
      <Button variant="outline" disabled={!logs.data?.items.length} onClick={() => downloadAdminLog(JSON.stringify(logs.data?.items, null, 2), "event-logs-page.json", "application/json")} title="Export the current page"><Download size={14} /> Export page</Button>
    </AdminPageHeader>
    <form onSubmit={applyFilters} onReset={() => { setFilters({ page: 0, size: 20, sort: "occurredAt,desc" }); setSelectedId(null); setFilterError(""); }} className="mb-6 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="relative min-w-52 flex-1"><span className="sr-only">Search event logs</span><Search size={15} className="pointer-events-none absolute left-3 top-3 text-muted-foreground" /><input name="q" placeholder="Search message, entity ID or trace ID" className={`${adminInputClass} w-full pl-9`} /></label>
        <label><span className="sr-only">Event type</span><input name="eventType" aria-label="Event type" placeholder="All events" className={`${adminInputClass} w-44`} /></label>
        <label><span className="sr-only">Entity type</span><input name="aggregateType" aria-label="Entity type" placeholder="All entity types" className={`${adminInputClass} w-40`} /></label>
        <Button type="submit" className="min-h-10">Apply filters</Button><Button type="reset" variant="outline" className="min-h-10">Reset</Button>
      </div>
      <details className="rounded-sm border border-border px-3 py-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground">More filters</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <AdminLogField name="aggregateId" label="Entity ID" placeholder="Exact entity ID" />
          <AdminLogField name="operatorId" label="Operator ID" placeholder="User UUID" />
          <AdminLogField name="from" label="From (local time)" type="datetime-local" />
          <AdminLogField name="to" label="To (local time)" type="datetime-local" />
          <label className="space-y-1.5 text-xs text-muted-foreground"><span className="block">Sort by</span><select name="sort" defaultValue="occurredAt,desc" className={`${adminSelectClass} w-full`}>
            <option value="occurredAt,desc">Newest first</option><option value="occurredAt,asc">Oldest first</option><option value="receivedAt,desc">Recently received</option><option value="receivedAt,asc">First received</option><option value="eventType,asc">Event type A–Z</option><option value="eventType,desc">Event type Z–A</option>
          </select></label>
        </div>
      </details>
      {filterError && <p role="alert" className="text-sm text-danger">{filterError}</p>}
    </form>
    {logs.isPending ? <p role="status" className="py-12 text-sm text-muted-foreground">Loading event logs…</p> : logs.error ? <AdminError error={logs.error} onRetry={() => void logs.refetch()} /> : logs.data && <>
      {logs.data.items.length === 0 ? <AdminEmptyState title="No events found" description="Adjust your filters to find captured events." /> : <div className={`grid min-w-0 gap-4 ${selectedId ? "lg:grid-cols-[minmax(0,5fr)_minmax(20rem,3fr)]" : ""}`}>
        <div className="min-w-0 overflow-x-auto rounded-sm border border-border">
          <table className="w-full text-left text-xs"><caption className="sr-only">Captured events; select an event to inspect its full payload</caption>
            <thead className="bg-muted text-muted-foreground"><tr>{["Time (UTC+7)", "Event", "Entity", "Topic", "Operator"].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap px-4 py-3 font-normal">{heading}</th>)}</tr></thead>
            <tbody>{logs.data.items.map((entry) => <tr key={entry.id} className={`border-t border-border ${selectedId === entry.id ? "bg-primary/5" : "hover:bg-muted/60"}`}>
              <td className="whitespace-nowrap px-4 py-4 font-mono text-muted-foreground"><time dateTime={entry.occurredAt}>{formatLogTime(entry.occurredAt)}</time></td>
              <th scope="row" className="px-4 py-4 text-left font-normal"><button id={`event-row-${entry.id}`} type="button" className="flex min-h-8 items-center gap-2 whitespace-nowrap text-left hover:text-primary hover:underline" onClick={() => setSelectedId(entry.id)} aria-pressed={selectedId === entry.id}><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-info" />{entry.eventType}</button></th>
              <td className="max-w-52 break-all px-4 py-4 font-mono">{entry.aggregateType && <span className="mb-1 block text-muted-foreground">{entry.aggregateType}</span>}{entry.aggregateId}</td>
              <td className="max-w-48 break-all px-4 py-4 font-mono text-muted-foreground">{entry.topic || "—"}</td>
              <td className="max-w-40 break-all px-4 py-4 font-mono text-muted-foreground">{entry.operatorId || "System"}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {selectedId && <EventDetail key={selectedId} id={selectedId} onClose={() => { const id = selectedId; setSelectedId(null); document.getElementById(`event-row-${id}`)?.focus(); }} />}
      </div>}
      <AdminPagination page={logs.data.page} onPageChange={(page) => { setFilters({ ...filters, page }); setSelectedId(null); }} />
    </>}
  </section>;
}

export default AdminEventLogsPage;
