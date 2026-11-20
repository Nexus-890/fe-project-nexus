"use client";

import { useState } from "react";
import { Plus, Warehouse as WarehouseIcon } from "lucide-react";
import { AdminEmptyState, AdminError, AdminPageHeader, adminInputClass } from "../components/AdminPrimitives";
import { sellerButton, sellerPrimary } from "../components/SellerUi";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { createAdminWarehouse, getAdminWarehouse, getAdminWarehouses, updateAdminWarehouse } from "../service/adminCatalogService";
import type { Warehouse, WarehouseInput } from "../types/adminCatalogType";
import { useAdminAction } from "./useAdminAction";

function WarehouseForm({ warehouse, close }: { warehouse?: Warehouse; close: () => void }) {
  const auth = useAuth();
  const [code, setCode] = useState(warehouse?.code ?? "");
  const [name, setName] = useState(warehouse?.name ?? "");
  const [address, setAddress] = useState(warehouse?.address ?? "");
  const [status, setStatus] = useState<Warehouse["status"]>(warehouse?.status ?? "ACTIVE");
  const save = useAdminAction((body: WarehouseInput, options) => warehouse ? updateAdminWarehouse(warehouse.id, { name: body.name, address: body.address, status }, options) : createAdminWarehouse(body, options), [queryKeys.backoffice.warehouses(auth.sessionId)], close);
  return <section className="rounded-sm border border-border bg-card p-5 sm:p-6" aria-label="Warehouse editor">
    <h2 className="mb-5 text-heading-20">{warehouse ? "Edit warehouse" : "New warehouse"}</h2>
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); save.run({ code: code.trim(), name: name.trim(), address: address.trim() || null }); }}>
      <fieldset disabled={save.isPending} className="space-y-5">
        <label className="block text-sm">Warehouse code<input aria-label="Warehouse code" className={`${adminInputClass} mt-2 font-mono`} required maxLength={40} pattern=".*\S.*" value={code} disabled={Boolean(warehouse)} onChange={(event) => setCode(event.target.value)} />{warehouse && <span className="mt-1 block text-xs text-muted-foreground">The warehouse code cannot be changed.</span>}</label>
        <label className="block text-sm">Warehouse name<input aria-label="Warehouse name" className={`${adminInputClass} mt-2`} required maxLength={150} pattern=".*\S.*" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="block text-sm">Address<textarea aria-label="Address" rows={3} className={`${adminInputClass} mt-2 resize-y`} value={address} onChange={(event) => setAddress(event.target.value)} /></label>
        {warehouse ? <label className="block text-sm">Status<select aria-label="Status" className={`${adminInputClass} mt-2`} value={status} onChange={(event) => setStatus(event.target.value as Warehouse["status"])}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="MAINTENANCE">Maintenance</option></select></label> : <p className="text-xs text-muted-foreground">New warehouses start with Active status.</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5"><button type="button" className={sellerButton} onClick={close}>Cancel</button><button type="submit" className={sellerPrimary}>{save.isPending ? "Saving…" : "Save warehouse"}</button></div>
      </fieldset>
      <AdminError error={save.error?.kind === "aborted" ? null : save.error} />
    </form>
  </section>;
}

function WarehouseEditor({ id, close }: { id: string; close: () => void }) {
  const auth = useAuth();
  const detail = useApiQuery({ queryKey: queryKeys.backoffice.warehouse(auth.sessionId, id), meta: { requiresAuth: true },
    service: (signal) => getAdminWarehouse(id, { context: auth.requestContext, signal }) }, { retry: false });
  if (detail.isPending) return <p role="status" className="text-sm">Loading warehouse…</p>;
  if (detail.error) return <AdminError error={detail.error} onRetry={() => void detail.refetch()} />;
  return <WarehouseForm warehouse={detail.data} close={close} />;
}

function AdminWarehousesPage() {
  const auth = useAuth();
  const [selected, setSelected] = useState<Warehouse | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const warehouses = useApiQuery({ queryKey: queryKeys.backoffice.warehouses(auth.sessionId), meta: { requiresAuth: true }, service: (signal) => getAdminWarehouses({ context: auth.requestContext, signal }) });
  const rows = (warehouses.data ?? []).filter((row) => (!status || row.status === status) && `${row.code} ${row.name} ${row.address ?? ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <>
    <AdminPageHeader title="Warehouses" description="Manage receiving locations and warehouse availability. Each seller gets one warehouse, created with their first stock intake."><button className={sellerPrimary} onClick={() => setSelected("new")}><Plus className="size-4" aria-hidden="true" />New warehouse</button></AdminPageHeader>
    <AdminError error={warehouses.error} onRetry={() => void warehouses.refetch()} />
    <div className={`grid min-w-0 items-start gap-6 ${selected ? "xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]" : ""}`}>
      <section className="min-w-0 rounded-sm border border-border bg-card">
        <div className="flex flex-wrap gap-3 border-b border-border p-4"><input aria-label="Search warehouses" placeholder="Search by code, name or address" className={`${adminInputClass} flex-1 basis-64`} value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filter warehouse status" className={`${adminInputClass} sm:w-auto`} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="MAINTENANCE">Maintenance</option></select></div>
        {warehouses.isPending ? <p role="status" className="p-6 text-sm">Loading warehouses…</p> : rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Warehouse", "Owner", "Address", "Status", "Action"].map((label) => <th className="px-4 py-3 font-medium" key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border"><td className="px-4 py-4"><div className="flex items-center gap-2"><WarehouseIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="font-medium">{row.name}</span></div><p className="mt-1 font-mono text-xs text-muted-foreground">{row.code}</p></td><td className="px-4 py-4">{row.sellerId ? <><span>Seller</span><p className="mt-1 font-mono text-xs text-muted-foreground" title={row.sellerId}>{row.sellerId.slice(0, 8)}</p></> : <span className="text-muted-foreground">Platform</span>}</td><td className="max-w-64 break-words px-4 py-4">{row.address || "—"}</td><td className="px-4 py-4"><span className={row.status === "ACTIVE" ? "text-success" : "text-muted-foreground"}>{row.status}</span></td><td className="px-4 py-4"><button aria-label={`Edit ${row.name}`} className={sellerButton} onClick={() => setSelected(row)}>Edit</button></td></tr>)}</tbody></table></div> : <AdminEmptyState title="No warehouses found" description="Create a warehouse to start receiving stock." />}
      </section>
      {selected === "new" ? <WarehouseForm key="new" close={() => setSelected(null)} /> : selected && <WarehouseEditor key={selected.id} id={selected.id} close={() => setSelected(null)} />}
    </div>
  </>;
}
export default AdminWarehousesPage;
