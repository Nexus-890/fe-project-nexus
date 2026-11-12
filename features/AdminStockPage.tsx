"use client";

import { useEffect, useRef, useState } from "react";
import { queryKeys } from "../configs/queryKeys";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getProduct, getProducts } from "../service/catalogService";
import { getStockBalances, intakeStock } from "../service/backofficeService";
import { SellerError, SellerHeading, SellerPanel, sellerButton, sellerInput, sellerPrimary } from "../components/SellerUi";
import type { StockBalance, StockIntakeInput } from "../types/backofficeType";
import { readBackofficeRoles } from "./backofficeAccess";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type StockOperation = { body: StockIntakeInput; sessionId: number; controller: AbortController };

function AdminStockPage() {
  const auth = useAuth();
  const isAdmin = auth.status === "authenticated" && readBackofficeRoles(auth.accessToken).includes("ADMIN");
  const [page, setPage] = useState(0);
  const [productId, setProductId] = useState("");
  const [skuId, setSkuId] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [validation, setValidation] = useState("");
  const [lastResult, setLastResult] = useState<StockBalance | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  const products = useApiQuery({ queryKey: queryKeys.backoffice.products(auth.sessionId, page), meta: { requiresAuth: true },
    service: (signal) => getProducts({ page, size: 10 }, { signal }) }, { enabled: isAdmin });
  const detail = useApiQuery({ queryKey: queryKeys.backoffice.product(auth.sessionId, productId), meta: { requiresAuth: true },
    service: (signal) => getProduct(productId, { signal }) }, { enabled: isAdmin && Boolean(productId), retry: false });
  const warehouseId = warehouse.trim() || undefined;
  const validWarehouse = warehouseId === undefined || uuid.test(warehouseId);
  const balances = useApiQuery({ queryKey: queryKeys.backoffice.balances(auth.sessionId, skuId, warehouseId), meta: { requiresAuth: true },
    service: (signal) => getStockBalances(skuId, warehouseId, { context: auth.requestContext, signal }) },
  { enabled: isAdmin && Boolean(skuId) && validWarehouse, retry: false });
  const mutation = useApiMutation<StockBalance, StockOperation>({
    mutationKey: queryKeys.backoffice.intake(auth.sessionId),
    execute: ({ body, controller }) => intakeStock(body, { context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey: [["backoffice", auth.sessionId, "balances"], ["seller", auth.sessionId], ["inventory", "available"]],
  }, {
    onSuccess: (result) => setLastResult(result),
    onSettled: (_data, _error, operation) => { if (active.current === operation.controller) active.current = null; },
  });

  if (!isAdmin) return <SellerPanel title="403 · Administrator access required"><p className="text-sm text-muted-foreground">Stock intake is available only to administrators.</p></SellerPanel>;

  return <>
    <SellerHeading title="Add stock" description="Receive units into any SKU’s warehouse balance. Sellers add stock to their own SKUs from the product page." />
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(260px,1fr)]">
      <SellerPanel title="Stock intake">
        <form className="space-y-5" onSubmit={(event) => {
          event.preventDefault();
          if (active.current) return;
          setValidation(""); setLastResult(null);
          const amount = Number(quantity);
          if (!skuId || !/^\d+$/.test(quantity) || !Number.isInteger(amount) || amount < 1 || amount > 2147483647 || !validWarehouse) {
            setValidation("Choose a SKU, enter a positive whole quantity and use a valid warehouse UUID or leave it blank."); return;
          }
          const controller = new AbortController(); active.current = controller;
          mutation.mutate({ body: { skuId, quantity: amount, ...(warehouseId ? { warehouseId } : {}) }, controller, sessionId: auth.sessionId });
        }}>
          <fieldset disabled={mutation.isPending} className="space-y-5">
            <label className="block text-sm">Product<select aria-label="Product" required value={productId} onChange={(event) => { setProductId(event.target.value); setSkuId(""); setLastResult(null); mutation.reset(); }} className={`${sellerInput} mt-2`}>
              <option value="">Select an active product</option>{products.data?.content.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select></label>
            {products.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading products…</p> : products.error ? <SellerError error={products.error} retry={() => void products.refetch()} /> : <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>Product page {page + 1} of {products.data?.totalPages || 1}</span><div className="flex gap-2"><button type="button" className={sellerButton} disabled={page === 0 || products.isFetching} onClick={() => { setPage((value) => value - 1); setProductId(""); setSkuId(""); setLastResult(null); }}>Previous products</button><button type="button" className={sellerButton} disabled={products.isFetching || page + 1 >= (products.data?.totalPages ?? 0)} onClick={() => { setPage((value) => value + 1); setProductId(""); setSkuId(""); setLastResult(null); }}>Next products</button></div></div>}
            <label className="block text-sm">SKU<select aria-label="SKU" required disabled={!productId || detail.isPending} value={skuId} onChange={(event) => { setSkuId(event.target.value); setLastResult(null); mutation.reset(); }} className={`${sellerInput} mt-2`}>
              <option value="">Select SKU</option>{detail.data?.skus.filter((sku) => sku.status === "ACTIVE").map((sku) => <option key={sku.id} value={sku.id}>{sku.skuCode} · {sku.color || "—"} · {sku.size || "—"}</option>)}
            </select></label>
            {productId && detail.isPending && <p role="status" className="text-sm text-muted-foreground">Loading SKUs…</p>}
            {detail.error && <SellerError error={detail.error} retry={() => void detail.refetch()} />}
            {detail.isSuccess && !detail.data.skus.some((sku) => sku.status === "ACTIVE") && <p role="status" className="text-sm text-muted-foreground">This product has no active SKU. Add and activate a SKU in the seller workspace first.</p>}
            <label className="block text-sm">Warehouse UUID (optional)<input aria-label="Warehouse UUID (optional)" value={warehouse} onChange={(event) => { setWarehouse(event.target.value); setLastResult(null); }} className={`${sellerInput} mt-2`} aria-invalid={!validWarehouse} placeholder="Use the default warehouse" /><span className="mt-2 block text-xs text-muted-foreground">Leave blank to receive stock into the configured default warehouse.</span></label>
            <label className="block text-sm">Quantity<input aria-label="Quantity" required inputMode="numeric" type="number" step="1" min="1" max="2147483647" value={quantity} onChange={(event) => setQuantity(event.target.value)} className={`${sellerInput} mt-2`} /></label>
            <button type="submit" disabled={mutation.isPending || !skuId || !validWarehouse} className={sellerPrimary}>{mutation.isPending ? "Adding stock…" : "Add stock"}</button>
          </fieldset>
          {validation && <p role="alert" className="text-sm text-danger">{validation}</p>}
          {mutation.error && mutation.error.kind !== "aborted" && <p role="alert" className="break-words text-sm text-danger">{mutation.error.detail || mutation.error.title}</p>}
          {lastResult && <div role="status" className="rounded-sm border border-success/30 bg-success/5 p-4 text-sm"><p className="font-medium text-success">Stock received.</p><dl className="mt-3 space-y-2"><div className="flex justify-between gap-3"><dt>On hand</dt><dd className="font-mono">{lastResult.total}</dd></div><div className="flex justify-between gap-3"><dt>Available</dt><dd className="font-mono">{lastResult.available}</dd></div><div><dt className="text-xs text-muted-foreground">Warehouse</dt><dd className="mt-1 break-all font-mono text-xs">{lastResult.warehouseId}</dd></div></dl></div>}
        </form>
      </SellerPanel>
      <SellerPanel title="Current balances">
        {!skuId ? <p className="text-sm text-muted-foreground">Select a product and SKU to inspect its warehouse balances.</p> : !validWarehouse ? <p className="text-sm text-muted-foreground">Correct the warehouse UUID to load its balance.</p> : balances.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading stock balances…</p> : balances.error ? <SellerError error={balances.error} retry={() => void balances.refetch()} /> : !balances.data?.length ? <p role="status" className="text-sm text-muted-foreground">No stock recorded for this SKU{warehouseId ? " in this warehouse" : ""}. The first intake creates its balance.</p> : <ul className="space-y-4">{balances.data.map((balance) => <li key={balance.warehouseId} className="rounded-sm border border-border p-4"><p className="break-all font-mono text-xs text-muted-foreground">{balance.warehouseId}</p><dl className="mt-3 grid grid-cols-2 gap-3 text-sm">{[["On hand", balance.total], ["Available", balance.available], ["Reserved", balance.reserved], ["Unavailable", balance.unavailable]].map(([label, amount]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-lg">{amount}</dd></div>)}</dl></li>)}</ul>}
      </SellerPanel>
    </div>
  </>;
}

export default AdminStockPage;
