"use client";

import { RefreshCw, Server } from "lucide-react";
import { Button } from "../components/button";
import { AdminEmptyState, AdminError, AdminPageHeader } from "../components/AdminPrimitives";
import { formatLogTime } from "../components/AdminLogTools";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getBrokerHealth, getSystemHealth } from "../service/adminObservabilityService";
import type { BrokerHealth, BrokerStatus, HealthStatus } from "../types/adminObservabilityType";
import { readBackofficeRoles } from "./backofficeAccess";

const statusNames: Record<HealthStatus, string> = { UP: "Operational", DOWN: "Unavailable", UNKNOWN: "Unknown" };
const statusColors: Record<HealthStatus, string> = { UP: "bg-info", DOWN: "bg-danger", UNKNOWN: "bg-warning" };

function HealthIndicator({ status }: { status: HealthStatus }) {
  return <span className="inline-flex shrink-0 items-center gap-2 text-xs"><span aria-hidden="true" className={`size-1.5 rounded-full ${statusColors[status]}`} />{statusNames[status]}</span>;
}

function AdminHealthPage() {
  const auth = useAuth();
  const roles = readBackofficeRoles(auth.accessToken);
  const allowed = roles.includes("ADMIN") || roles.includes("SUPPORT_STAFF");
  const enabled = auth.status === "authenticated" && allowed;
  const health = useApiQuery({
    queryKey: queryKeys.admin.health(auth.sessionId),
    service: (signal) => getSystemHealth({ context: auth.requestContext, signal }),
    meta: { requiresAuth: true },
  }, { enabled, refetchInterval: 10_000, refetchIntervalInBackground: true });
  const brokerHealth = useApiQuery({
    queryKey: queryKeys.admin.brokers(auth.sessionId),
    service: (signal) => getBrokerHealth({ context: auth.requestContext, signal }),
    meta: { requiresAuth: true },
  }, { enabled, refetchInterval: 10_000, refetchIntervalInBackground: true });
  const brokers: (BrokerStatus & Partial<Pick<BrokerHealth, "lastFailureAt" | "lastRecoveredAt">>)[] = brokerHealth.data ?? health.data?.brokers ?? [];
  const services = health.data?.services ?? [];
  const unavailable = [...services, ...brokers].filter((item) => item.status === "DOWN").length;
  const unknown = [...services, ...brokers].filter((item) => item.status === "UNKNOWN").length;
  const hasSystems = services.length + brokers.length > 0;
  const refresh = () => { void health.refetch(); void brokerHealth.refetch(); };
  if (!allowed) return <AdminEmptyState title="System health access required" description="Only administrators and support staff can view system health." />;
  return <section aria-label="System health" className="min-w-0 space-y-6">
    <AdminPageHeader title="System Health" description="Service and broker status · refreshes every 10 seconds">
      <div className="flex flex-wrap items-center gap-4">
        {health.data && !health.error && !brokerHealth.error && <p role="status" className="inline-flex items-center gap-2 text-xs"><span className={`size-2 rounded-full ${!hasSystems ? "bg-muted-foreground" : unavailable ? "bg-danger" : unknown ? "bg-warning" : "bg-info"}`} aria-hidden="true" />{!hasSystems ? "No systems reported" : unavailable ? `${unavailable} unavailable` : unknown ? `${unknown} unknown` : "All systems operational"}</p>}
        <Button variant="outline" onClick={refresh} disabled={health.isFetching || brokerHealth.isFetching}><RefreshCw size={14} className={health.isFetching || brokerHealth.isFetching ? "animate-spin" : ""} />Refresh</Button>
      </div>
    </AdminPageHeader>
    {health.isPending && <p role="status" className="mb-6 text-sm text-muted-foreground">Checking services…</p>}
    {health.error && <div className="mb-6"><AdminError error={health.error} onRetry={() => void health.refetch()} />{health.data && <p className="mt-2 text-xs text-warning">Service statuses below are from the last successful refresh.</p>}</div>}
    {brokerHealth.error && <div className="mb-6"><AdminError error={brokerHealth.error} onRetry={() => void brokerHealth.refetch()} />{brokerHealth.data && <p className="mt-2 text-xs text-warning">Broker statuses below are from the last successful refresh.</p>}</div>}
    <div className="space-y-4" aria-label="Message broker health">
      {brokerHealth.isPending && !brokers.length ? <p role="status" className="py-8 text-sm text-muted-foreground">Checking message brokers…</p> : brokers.map((broker) => <article key={broker.name} className="rounded-sm border border-border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4"><Server size={24} className="mt-1 text-info" aria-hidden="true" /><div><h2 className="text-base font-semibold">Message Broker · {broker.name}</h2><p className="mt-1 text-xs text-muted-foreground">Last checked (UTC+7): {formatLogTime(broker.lastCheckedAt)}</p></div></div>
          <HealthIndicator status={broker.status} />
        </div>
        <div className={`mt-5 h-2 rounded-sm ${statusColors[broker.status]}`} aria-hidden="true" />
        {"lastFailureAt" in broker && <dl className="mt-5 grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-muted-foreground">Last failure (UTC+7)</dt><dd className="mt-1 font-mono">{formatLogTime(broker.lastFailureAt)}</dd></div><div><dt className="text-muted-foreground">Last recovery (UTC+7)</dt><dd className="mt-1 font-mono">{formatLogTime(broker.lastRecoveredAt)}</dd></div></dl>}
      </article>)}
      {!brokerHealth.isPending && !brokerHealth.error && !brokers.length && <AdminEmptyState title="No brokers reported" description="No message brokers are configured in the current health response." />}
    </div>
    <div className="mt-8 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Service health">
      {services.map((service) => <article key={service.name} className="border-t border-border py-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-medium"><span className={`size-2 shrink-0 rounded-full ${statusColors[service.status]}`} aria-hidden="true" />{service.name}</h2><HealthIndicator status={service.status} /></div></article>)}
    </div>
    {health.data && !services.length && <AdminEmptyState title="No services reported" description="No services are configured in the current health response." />}
    {health.dataUpdatedAt > 0 && <p className="mt-8 text-xs text-muted-foreground">Last successful service refresh (UTC+7): <time dateTime={new Date(health.dataUpdatedAt).toISOString()}>{formatLogTime(new Date(health.dataUpdatedAt).toISOString())}</time></p>}
  </section>;
}

export default AdminHealthPage;
