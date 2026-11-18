"use client";

import { useState } from "react";
import { Search, Settings2 } from "lucide-react";
import { AdminEmptyState, AdminError, AdminPageHeader, adminInputClass } from "../components/AdminPrimitives";
import { sellerButton, sellerPrimary } from "../components/SellerUi";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getSystemConfigs, updateSystemConfig, type ConfigValue, type SystemConfig } from "../service/adminConfigService";
import { useAdminAction } from "./useAdminAction";

const switchClass = "relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-muted-foreground/40 transition-colors before:absolute before:left-0.5 before:top-0.5 before:size-5 before:rounded-full before:bg-white before:shadow-sm before:transition-transform checked:bg-primary checked:before:translate-x-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50";

function ConfigEditor({ config }: { config: SystemConfig }) {
  const auth = useAuth();
  const [value, setValue] = useState<ConfigValue>(config.value);
  const [saved, setSaved] = useState(false);
  const save = useAdminAction((next: ConfigValue, options) => updateSystemConfig(config.key, next, options), [queryKeys.backoffice.systemConfigs(auth.sessionId)], (result) => { setValue(result.value); setSaved(true); });
  const changed = String(value) !== String(config.value);
  const externallyManaged = config.applyMode === "KEYCLOAK_MANAGED";
  const edit = (next: ConfigValue) => { setValue(next); setSaved(false); };
  return <li className="border-t border-border first:border-t-0"><form className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:gap-6" onSubmit={(event) => {
    event.preventDefault();
    if (externallyManaged) return;
    const numeric = typeof (config.value ?? config.defaultValue) === "number";
    const next = numeric && typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : value;
    setSaved(false); save.run(next);
  }}>
    <div className="min-w-0 flex-1">
      <p className="break-words font-mono text-sm font-medium">{config.key}</p>
      <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
      <p className="mt-1 text-xs text-muted-foreground">Default <span className="font-mono">{String(config.defaultValue)}</span> · Configured <span className="font-mono">{String(config.configuredValue)}</span> · {config.applyMode === "RUNTIME" ? "Runtime" : externallyManaged ? "Managed by Keycloak" : "Config Server"}</p>
    </div>
    <div className="flex shrink-0 flex-col gap-1 md:items-end">
      <div className="flex items-center gap-2">
        {typeof config.value === "boolean" ? <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <span className={value ? "font-medium" : "text-muted-foreground"}>{value ? "On" : "Off"}</span>
          <input type="checkbox" role="switch" aria-label={`Value for ${config.key}`} checked={value === true} disabled={externallyManaged || save.isPending} onChange={(event) => edit(event.target.checked)} className={switchClass} />
        </label> : <input aria-label={`Value for ${config.key}`} className={`${adminInputClass} w-40 font-mono`} value={String(value)} disabled={externallyManaged || save.isPending} onChange={(event) => edit(event.target.value)} />}
        {!externallyManaged && <>
          {changed && <button type="button" disabled={save.isPending} className={sellerButton} onClick={() => { setValue(config.value); setSaved(false); save.reset(); }}>Discard</button>}
          <button type="submit" disabled={!changed || save.isPending} className={sellerPrimary}>{save.isPending ? "Saving…" : "Save"}</button>
        </>}
      </div>
      <AdminError error={save.error?.kind === "aborted" ? null : save.error} />
      {saved && <p role="status" className="text-xs text-success">Configuration saved.</p>}
    </div>
  </form></li>;
}

function AdminConfigurationPage() {
  const auth = useAuth();
  const [service, setService] = useState("");
  const [search, setSearch] = useState("");
  const configs = useApiQuery({ queryKey: queryKeys.backoffice.systemConfigs(auth.sessionId), meta: { requiresAuth: true }, service: (signal) => getSystemConfigs({ context: auth.requestContext, signal }) }, { retry: false });
  const services = [...new Set((configs.data ?? []).map((row) => row.service))];
  const rows = (configs.data ?? []).filter((row) => (!service || row.service === service) && `${row.key} ${row.description} ${row.service}`.toLowerCase().includes(search.toLowerCase()));
  const error = configs.error && [404, 503].includes(configs.error.status) ? { ...configs.error, detail: "System configuration is currently unavailable. Please try again later." } : configs.error;
  return <>
    <AdminPageHeader title="System Configuration" description="Manage platform settings and feature flags." />
    <AdminError error={error} onRetry={() => void configs.refetch()} />
    {configs.isPending ? <p role="status" className="text-sm">Loading configuration…</p> : configs.data && <div className="grid min-w-0 items-start gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Configuration services" className="min-w-0 rounded-sm border border-border p-2">{["", ...services].map((item) => <button key={item} aria-pressed={service === item} onClick={() => setService(item)} className={`flex min-h-11 w-full items-center gap-2 rounded-sm px-3 text-left text-sm ${service === item ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted"}`}><Settings2 className="size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{item || "All services"}</span></button>)}</nav>
      <section className="min-w-0 rounded-sm border border-border"><label className="flex items-center gap-2 border-b border-border px-4 py-3"><Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><input aria-label="Search configuration" placeholder="Search configuration keys" value={search} onChange={(event) => setSearch(event.target.value)} className={`${adminInputClass} border-0`} /></label>
        {!rows.length ? <AdminEmptyState title="No configuration keys found" /> : (service ? [service] : services).filter((name) => rows.some((row) => row.service === name)).map((name) => <div key={name}>
          <h2 className="border-b border-border bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{name}</h2>
          <ul>{rows.filter((row) => row.service === name).map((row) => <ConfigEditor key={row.key} config={row} />)}</ul>
        </div>)}
      </section>
    </div>}
  </>;
}
export default AdminConfigurationPage;
