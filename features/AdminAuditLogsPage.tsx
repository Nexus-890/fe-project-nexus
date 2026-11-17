"use client";

import { useState, type FormEvent } from "react";
import { Download, LockKeyhole } from "lucide-react";
import { Button } from "../components/button";
import { AdminEmptyState, AdminError, AdminPageHeader, AdminPagination } from "../components/AdminPrimitives";
import { AdminLogField, csvLogCell, downloadAdminLog, formatLogTime, logFormText, logFormTime } from "../components/AdminLogTools";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getAuditLogs } from "../service/adminObservabilityService";
import type { AuditLogFilters } from "../types/adminObservabilityType";
import { readBackofficeRoles } from "./backofficeAccess";

function AdminAuditLogsPage() {
  const auth = useAuth();
  const admin = readBackofficeRoles(auth.accessToken).includes("ADMIN");
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 0, size: 20 });
  const [filterError, setFilterError] = useState("");
  const logs = useApiQuery({
    queryKey: queryKeys.admin.audit(auth.sessionId, filters),
    service: (signal) => getAuditLogs(filters, { context: auth.requestContext, signal }),
    meta: { requiresAuth: true },
  }, { enabled: auth.status === "authenticated" && admin });
  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const from = logFormTime(data, "from");
    const to = logFormTime(data, "to");
    if (from && to && from > to) { setFilterError("Start time must be before or equal to end time."); return; }
    setFilterError("");
    setFilters({ actorId: logFormText(data, "actorId"), action: logFormText(data, "action"), entityType: logFormText(data, "entityType"), entityId: logFormText(data, "entityId"), from, to, page: 0, size: 20 });
  };
  const exportCsv = () => {
    if (!logs.data) return;
    const headers = ["Time (UTC)", "Actor ID", "Action", "Entity type", "Entity ID", "Trace ID", "Event ID"];
    const rows = logs.data.items.map((entry) => [entry.occurredAt, entry.actorId, entry.action, entry.entityType, entry.entityId, entry.traceId, entry.eventId]);
    downloadAdminLog([headers, ...rows].map((row) => row.map(csvLogCell).join(",")).join("\r\n"), "audit-logs-page.csv", "text/csv;charset=utf-8");
  };
  if (!admin) return <AdminEmptyState title="Administrator access required" description="Only administrators can view the audit log." />;
  return <section aria-label="Audit logs" className="min-w-0 space-y-6">
    <AdminPageHeader title="Audit Logs" description="Immutable record of critical actions · newest first">
      <Button variant="outline" disabled={!logs.data?.items.length} onClick={exportCsv} title="Export the current page"><Download size={14} /> Export page CSV</Button>
    </AdminPageHeader>
    <form onSubmit={applyFilters} onReset={() => { setFilters({ page: 0, size: 20 }); setFilterError(""); }} className="mb-6 space-y-3">
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto_auto]">
        <AdminLogField name="actorId" label="Actor ID" placeholder="Search by actor UUID" />
        <AdminLogField name="action" label="Action" placeholder="All actions (exact event type)" />
        <Button type="submit" className="min-h-10">Apply filters</Button><Button type="reset" variant="outline" className="min-h-10">Reset</Button>
      </div>
      <details className="rounded-sm border border-border px-3 py-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground">Entity and date filters</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminLogField name="entityType" label="Entity type" placeholder="All entity types" />
          <AdminLogField name="entityId" label="Entity ID" placeholder="Exact entity ID" />
          <AdminLogField name="from" label="From (local time)" type="datetime-local" />
          <AdminLogField name="to" label="To (local time)" type="datetime-local" />
        </div>
      </details>
      {filterError && <p role="alert" className="text-sm text-danger">{filterError}</p>}
    </form>
    {logs.isPending ? <p role="status" className="py-12 text-sm text-muted-foreground">Loading audit logs…</p> : logs.error ? <AdminError error={logs.error} onRetry={() => void logs.refetch()} /> : logs.data && <>
      {logs.data.items.length === 0 ? <AdminEmptyState title="No audit entries found" description="Adjust your filters to find critical actions." /> : <div className="overflow-x-auto rounded-sm border border-border">
        <table className="w-full text-left text-xs"><caption className="sr-only">Immutable audit entries</caption>
          <thead className="bg-muted text-muted-foreground"><tr>{["Time (UTC+7)", "Actor", "Action", "Entity", "Trace ID"].map((heading) => <th scope="col" key={heading} className="whitespace-nowrap px-4 py-3 font-normal">{heading}</th>)}</tr></thead>
          <tbody>{logs.data.items.map((entry) => <tr key={entry.id} className="border-t border-border hover:bg-muted/60">
            <td className="whitespace-nowrap px-4 py-5 font-mono"><time dateTime={entry.occurredAt}>{formatLogTime(entry.occurredAt)}</time></td>
            <td className="max-w-56 break-all px-4 py-5"><div className="flex items-center gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium" aria-hidden="true">{entry.actorId ? entry.actorId.slice(0, 2).toUpperCase() : "SY"}</span><span className="font-mono">{entry.actorId || "System"}</span></div></td>
            <th scope="row" className="max-w-56 break-all px-4 py-5 font-mono text-left font-normal">{entry.action}</th>
            <td className="max-w-56 break-all px-4 py-5 font-mono">{entry.entityType && <span className="mb-1 block text-muted-foreground">{entry.entityType}</span>}{entry.entityId}</td>
            <td className="max-w-56 break-all px-4 py-5 font-mono text-muted-foreground">{entry.traceId}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <AdminPagination page={logs.data.page} onPageChange={(page) => setFilters({ ...filters, page })} />
    </>}
    <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground"><LockKeyhole size={14} className="shrink-0" aria-hidden="true" />Audit entries are append-only and cannot be edited or deleted from the console.</p>
  </section>;
}

export default AdminAuditLogsPage;
