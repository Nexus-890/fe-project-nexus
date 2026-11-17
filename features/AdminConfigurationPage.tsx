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

function ConfigEditor({ config }: { config: SystemConfig }) {
  const auth = useAuth();
  const [value, setValue] = useState<ConfigValue>(config.value);
  const [saved, setSaved] = useState(false);
  const save = useAdminAction((next: ConfigValue, options) => updateSystemConfig(config.key, next, options), [queryKeys.backoffice.systemConfigs(auth.sessionId)], (result) => { setValue(result.value); setSaved(true); });
  const changed = String(value) !== String(config.value);
  const externallyManaged = config.applyMode === "KEYCLOAK_MANAGED";
  return <tr className="border-t border-border align-top">
    <th scope="row" className="min-w-56 max-w-64 break-words px-4 py-4 text-left font-mono text-xs font-normal">{config.key}</th>
    <td className="min-w-44 max-w-56 px-4 py-4 text-xs text-muted-foreground"><p>{config.service}</p><p className="mt-1 font-mono">{config.applyMode}</p></td>
    <td className="min-w-48 max-w-72 px-4 py-4 text-xs text-muted-foreground">{config.description}</td>
    <td className="min-w-60 px-4 py-3"><form className="space-y-3" onSubmit={(event) => {
      event.preventDefault();
      if (externallyManaged) return;
      // Numeric text that is not a number is sent as a string so the backend owns type validation.
      const numeric = typeof (config.value ?? config.defaultValue) === "number";
      const next = numeric && typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : value;
      setSaved(false); save.run(next);
    }}><div className="flex items-center gap-2">
      {typeof config.value === "boolean" ? <label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" aria-label={`Value for ${config.key}`} checked={value === true} disabled={externallyManaged || save.isPending} onChange={(event) => { setValue(event.target.checked); setSaved(false); }} className="size-4 accent-primary" />{value ? "Enabled" : "Disabled"}</label> : <input aria-label={`Value for ${config.key}`} className={`${adminInputClass} font-mono`} value={String(value)} disabled={externallyManaged || save.isPending} onChange={(event) => { setValue(event.target.value); setSaved(false); }} />}
      {externallyManaged ? <span className="text-xs text-muted-foreground">Managed by Keycloak</span> : <button type="submit" disabled={!changed || save.isPending} className={sellerPrimary}>{save.isPending ? "Saving…" : "Save"}</button>}
    </div>{changed && <button type="button" disabled={save.isPending} className={sellerButton} onClick={() => { setValue(config.value); setSaved(false); save.reset(); }}>Discard</button>}
    <AdminError error={save.error?.kind === "aborted" ? null : save.error} />{saved && <p role="status" className="text-xs text-success">Configuration saved.</p>}</form></td>
    <td className="px-4 py-4 text-xs text-muted-foreground"><p>Default: <span className="font-mono">{String(config.defaultValue)}</span></p><p className="mt-1">Configured: <span className="font-mono">{String(config.configuredValue)}</span></p></td>
  </tr>;
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
        {!rows.length ? <AdminEmptyState title="No configuration keys found" /> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Key", "Service / mode", "Description", "Value", "Default / source"].map((label) => <th scope="col" key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <ConfigEditor key={row.key} config={row} />)}</tbody></table></div>}
      </section>
    </div>}
  </>;
}
export default AdminConfigurationPage;
