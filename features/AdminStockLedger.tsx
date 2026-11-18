"use client";

import { useState } from "react";
import { AdminEmptyState, AdminError, AdminPagination } from "../components/AdminPrimitives";
import { SellerPanel } from "../components/SellerUi";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getAdminMovements } from "../service/adminCatalogService";
import type { Warehouse } from "../types/adminCatalogType";

function AdminStockLedger({ skuId, warehouseId, warehouses }: { skuId: string; warehouseId?: string; warehouses: Warehouse[] }) {
  const auth = useAuth();
  const [page, setPage] = useState(0);
  const ledger = useApiQuery({ queryKey: queryKeys.backoffice.movements(auth.sessionId, skuId, warehouseId, page), meta: { requiresAuth: true },
    service: (signal) => getAdminMovements(skuId, warehouseId, page, { context: auth.requestContext, signal }) }, { enabled: Boolean(skuId), retry: false });
  return <SellerPanel title="Movement ledger">
    <p className="mb-5 text-sm text-muted-foreground">Stock history for the selected SKU. All quantities are recorded by the inventory service.</p>
    {!skuId ? <AdminEmptyState title="Select a SKU to view its movements" /> : ledger.isPending ? <p role="status" className="text-sm">Loading movements…</p> : ledger.error ? <AdminError error={ledger.error} onRetry={() => void ledger.refetch()} /> : <>
      {!ledger.data.content.length ? <AdminEmptyState title="No movements recorded" /> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Time", "Movement", "Quantity", "Warehouse", "Reference / reason"].map((label) => <th scope="col" key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{ledger.data.content.map((row) => <tr key={row.id} className="border-t border-border"><td className="whitespace-nowrap px-4 py-3 text-xs"><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString()}</time></td><td className="px-4 py-3 text-xs">{row.movementType}</td><td className="px-4 py-3 font-mono">{row.quantity}</td><td className="px-4 py-3 text-xs">{warehouses.find((warehouse) => warehouse.id === row.warehouseId)?.name ?? row.warehouseId}</td><td className="max-w-64 break-all px-4 py-3 text-xs"><p className="font-mono">{row.referenceId || "—"}</p>{row.reason && <p className="mt-1">{row.reason}</p>}</td></tr>)}</tbody></table></div>}
      <div className="mt-5"><AdminPagination page={{ number: ledger.data.page, size: ledger.data.size, totalElements: ledger.data.totalElements, totalPages: ledger.data.totalPages }} onPageChange={setPage} /></div>
    </>}
  </SellerPanel>;
}
export default AdminStockLedger;
