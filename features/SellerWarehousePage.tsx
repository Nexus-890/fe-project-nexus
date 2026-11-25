"use client";

import { useEffect, useRef, useState } from "react";
import { Warehouse as WarehouseIcon } from "lucide-react";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { getOwnWarehouse, saveOwnWarehouse } from "../service/adminCatalogService";
import { getPublicProvinces, getPublicWards } from "../service/checkoutService";
import { SellerError, SellerHeading, SellerPanel, sellerInput, sellerPrimary } from "../components/SellerUi";
import type { OwnWarehouseInput, Warehouse } from "../types/adminCatalogType";

type SaveOperation = { body: OwnWarehouseInput; sessionId: number; controller: AbortController };

function usePickupAddress(address: string | null | undefined, provinceCode: string | null | undefined, wardCode: string | null | undefined) {
  const provinces = useApiQuery({ queryKey: queryKeys.shipping.provinces(), service: (signal) => getPublicProvinces({ signal }) }, { staleTime: Infinity });
  const wards = useApiQuery({ queryKey: queryKeys.shipping.wards(provinceCode ?? ""), service: (signal) => getPublicWards(provinceCode ?? "", { signal }) },
    { enabled: Boolean(provinceCode), staleTime: Infinity });
  const line = address?.trim();
  const provinceName = provinces.data?.find((province) => province.code === provinceCode)?.name;
  const wardName = wards.data?.find((ward) => ward.code === wardCode)?.name;
  return { provinces, wards, full: line && wardName && provinceName ? `${line}, ${wardName}, ${provinceName}` : null };
}

function OwnWarehouseForm({ warehouse }: { warehouse: Warehouse | null }) {
  const auth = useAuth();
  const [name, setName] = useState(warehouse?.name ?? "");
  const [address, setAddress] = useState(warehouse?.address ?? "");
  const [provinceCode, setProvinceCode] = useState(warehouse?.provinceCode ?? "");
  const [wardCode, setWardCode] = useState(warehouse?.wardCode ?? "");
  const [saved, setSaved] = useState(false);
  const { provinces, wards, full: pickupAddress } = usePickupAddress(address, provinceCode, wardCode);
  const pickupStarted = Boolean(provinceCode || wardCode);
  const pickupIncomplete = pickupStarted && (!provinceCode || !wardCode || !address.trim());
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const mutation = useApiMutation<Warehouse, SaveOperation>({
    mutationKey: ["seller", auth.sessionId, "save-warehouse"],
    execute: ({ body, controller }) => saveOwnWarehouse(body, { context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey: [queryKeys.seller.warehouse(auth.sessionId)],
  }, { onSuccess: (data) => { setName(data.name); setAddress(data.address ?? ""); setProvinceCode(data.provinceCode ?? ""); setWardCode(data.wardCode ?? ""); setSaved(true); }, onSettled: (_data, _error, operation) => { if (pending.current === operation.controller) pending.current = null; } });
  return <SellerPanel title={warehouse ? "Warehouse details" : "Set up your warehouse"}>
    <form className="max-w-2xl space-y-5" onSubmit={(event) => {
      event.preventDefault(); if (pending.current || pickupIncomplete) return;
      setSaved(false); const controller = new AbortController(); pending.current = controller;
      mutation.mutate({ body: { name: name.trim(), address: address.trim() || null, ...(provinceCode && wardCode ? { provinceCode, wardCode } : {}) }, sessionId: auth.sessionId, controller });
    }}>
      <fieldset disabled={mutation.isPending} className="space-y-5">
        <label className="block text-sm">Warehouse name<input aria-label="Warehouse name" required maxLength={150} pattern=".*\S.*" value={name} onChange={(event) => setName(event.target.value)} className={`${sellerInput} mt-2`} placeholder="District 7 warehouse" /></label>
        <fieldset className="space-y-3">
          <legend className="text-sm">Pickup address</legend>
          <p id="warehouse-pickup-help" className="text-xs leading-5 text-muted-foreground">Carriers collect your parcels here and shipping fees are quoted from it. Without a province and ward, orders ship from the platform pickup address.</p>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <select aria-label="Province or city" value={provinceCode} disabled={provinces.isPending || provinces.isError} aria-describedby="warehouse-pickup-help" className={sellerInput}
              onChange={(event) => { setProvinceCode(event.target.value); setWardCode(""); }}>
              <option value="">{provinces.isPending ? "Loading provinces…" : provinces.isError ? "Provinces unavailable" : "Province / City"}</option>
              {provinces.data?.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
            </select>
            <select aria-label="Ward or commune" value={wardCode} disabled={!provinceCode || wards.isPending || wards.isError} aria-describedby="warehouse-pickup-help" className={sellerInput}
              onChange={(event) => setWardCode(event.target.value)}>
              <option value="">{provinceCode && wards.isPending ? "Loading wards…" : wards.isError ? "Wards unavailable" : "Ward / Commune"}</option>
              {wards.data?.map((ward) => <option key={ward.code} value={ward.code}>{ward.name}</option>)}
            </select>
          </div>
          <input aria-label="House number and street" required={pickupStarted} maxLength={pickupStarted ? 255 : 500} value={address} onChange={(event) => setAddress(event.target.value)}
            autoComplete="address-line1" placeholder="House number and street" aria-describedby="warehouse-pickup-help" className={sellerInput} />
          {pickupAddress && <p data-testid="warehouse-pickup-preview" aria-live="polite" className="break-words rounded-sm bg-muted px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">Carriers pick up at: </span>{pickupAddress}</p>}
          {pickupStarted && pickupIncomplete && <p className="text-xs text-danger">Choose a province, a ward and enter the house number and street, or clear the province to ship from the platform pickup.</p>}
        </fieldset>
        <button type="submit" disabled={pickupIncomplete} className={sellerPrimary}>{mutation.isPending ? "Saving warehouse…" : "Save warehouse"}</button>
      </fieldset>
      {mutation.error && mutation.error.kind !== "aborted" && <p role="alert" className="text-sm text-danger">{mutation.error.detail || "The warehouse could not be saved. Try again."}</p>}
      {saved && <p role="status" className="text-sm text-success">Warehouse saved.</p>}
    </form>
  </SellerPanel>;
}

function WarehouseSummary({ warehouse }: { warehouse: Warehouse }) {
  const { full } = usePickupAddress(warehouse.address, warehouse.provinceCode, warehouse.wardCode);
  const fromWarehouse = Boolean(warehouse.provinceCode && warehouse.wardCode);
  return <dl className="space-y-4 text-sm">
    <div className="flex items-center gap-2"><WarehouseIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="font-medium">{warehouse.name}</span></div>
    <div><dt className="text-xs text-muted-foreground">Code</dt><dd className="mt-1 break-all font-mono text-xs">{warehouse.code}</dd></div>
    <div><dt className="text-xs text-muted-foreground">Status</dt><dd className={`mt-1 ${warehouse.status === "ACTIVE" ? "text-success" : "text-muted-foreground"}`}>{warehouse.status}</dd></div>
    <div><dt className="text-xs text-muted-foreground">Address</dt><dd className="mt-1 break-words">{(fromWarehouse && full) || warehouse.address || "—"}</dd></div>
    <div><dt className="text-xs text-muted-foreground">Carrier pickup</dt><dd className="mt-1 break-words">{fromWarehouse ? "From this warehouse" : "Platform pickup address"}</dd></div>
    {warehouse.status !== "ACTIVE" && <p role="status" className="text-xs text-muted-foreground">An administrator has paused this warehouse, so new stock cannot be received until it is Active again.</p>}
  </dl>;
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
      <SellerPanel title="Summary">{warehouse ? <WarehouseSummary warehouse={warehouse} /> : <p role="status" className="text-sm text-muted-foreground">No warehouse yet. Save its name here, or add stock to a SKU and it is created for you.</p>}</SellerPanel>
    </div>}
  </>;
}
export default SellerWarehousePage;
