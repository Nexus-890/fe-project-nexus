"use client";

import { useEffect, useRef, useState } from "react";
import { Warehouse as WarehouseIcon } from "lucide-react";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { getOwnWarehouse, saveOwnWarehouse } from "../service/adminCatalogService";
import { SellerError, SellerHeading, SellerPanel, sellerInput, sellerPrimary } from "../components/SellerUi";
import type { OwnWarehouseInput, Warehouse } from "../types/adminCatalogType";

type SaveOperation = { body: OwnWarehouseInput; sessionId: number; controller: AbortController };

function OwnWarehouseForm({ warehouse }: { warehouse: Warehouse | null }) {
  const auth = useAuth();
  const [name, setName] = useState(warehouse?.name ?? "");
  const [address, setAddress] = useState(warehouse?.address ?? "");
  const [saved, setSaved] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const mutation = useApiMutation<Warehouse, SaveOperation>({
    mutationKey: ["seller", auth.sessionId, "save-warehouse"],
    execute: ({ body, controller }) => saveOwnWarehouse(body, { context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey: [queryKeys.seller.warehouse(auth.sessionId)],
  }, { onSuccess: (data) => { setName(data.name); setAddress(data.address ?? ""); setSaved(true); }, onSettled: (_data, _error, operation) => { if (pending.current === operation.controller) pending.current = null; } });
  return <SellerPanel title={warehouse ? "Warehouse details" : "Set up your warehouse"}>
    <form className="max-w-2xl space-y-5" onSubmit={(event) => {
      event.preventDefault(); if (pending.current) return;
      setSaved(false); const controller = new AbortController(); pending.current = controller;
      mutation.mutate({ body: { name: name.trim(), address: address.trim() || null }, sessionId: auth.sessionId, controller });
    }}>
      <fieldset disabled={mutation.isPending} className="space-y-5">
        <label className="block text-sm">Warehouse name<input aria-label="Warehouse name" required maxLength={150} pattern=".*\S.*" value={name} onChange={(event) => setName(event.target.value)} className={`${sellerInput} mt-2`} placeholder="District 7 warehouse" /></label>
        <label className="block text-sm">Address<textarea aria-label="Address" rows={3} maxLength={500} value={address} onChange={(event) => setAddress(event.target.value)} className={`${sellerInput} mt-2 resize-y`} /></label>
        <button type="submit" className={sellerPrimary}>{mutation.isPending ? "Saving warehouse…" : "Save warehouse"}</button>
      </fieldset>
      {mutation.error && mutation.error.kind !== "aborted" && <p role="alert" className="text-sm text-danger">{mutation.error.detail || "The warehouse could not be saved. Try again."}</p>}
      {saved && <p role="status" className="text-sm text-success">Warehouse saved.</p>}
    </form>
  </SellerPanel>;
}

function SellerWarehousePage() {
  const auth = useAuth();
  const query = useApiQuery({ queryKey: queryKeys.seller.warehouse(auth.sessionId), meta: { requiresAuth: true },
    service: (signal) => getOwnWarehouse({ context: auth.requestContext, signal }) }, { retry: false });
  const warehouse = query.data ?? null;
  return <>
    <SellerHeading title="Warehouse" description="Every seller has one warehouse. Stock you add to your SKUs is received here and orders reserve from it." />
    {query.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading warehouse…</p> : query.error ? <SellerError error={query.error} retry={() => void query.refetch()} /> : <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(260px,1fr)]">
      <OwnWarehouseForm warehouse={warehouse} />
      <SellerPanel title="Summary">{warehouse ? <dl className="space-y-4 text-sm">
        <div className="flex items-center gap-2"><WarehouseIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="font-medium">{warehouse.name}</span></div>
        <div><dt className="text-xs text-muted-foreground">Code</dt><dd className="mt-1 break-all font-mono text-xs">{warehouse.code}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Status</dt><dd className={`mt-1 ${warehouse.status === "ACTIVE" ? "text-success" : "text-muted-foreground"}`}>{warehouse.status}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Address</dt><dd className="mt-1 break-words">{warehouse.address || "—"}</dd></div>
        {warehouse.status !== "ACTIVE" && <p role="status" className="text-xs text-muted-foreground">An administrator has paused this warehouse, so new stock cannot be received until it is Active again.</p>}
      </dl> : <p role="status" className="text-sm text-muted-foreground">No warehouse yet. Save its name here, or add stock to a SKU and it is created for you.</p>}</SellerPanel>
    </div>}
  </>;
}
export default SellerWarehousePage;
