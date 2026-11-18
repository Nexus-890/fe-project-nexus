"use client";
import { useState } from "react";
import { AdminError } from "../components/AdminPrimitives";
import { sellerButton } from "../components/SellerUi";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getProducts } from "../service/catalogService";
import { getSellerProducts } from "../service/sellerService";

function VoucherProductChoices({ admin, selected, onChange }: { admin: boolean; selected: string[]; onChange: (ids: string[]) => void }) {
  const auth = useAuth(); const [page, setPage] = useState(0);
  const result = useApiQuery({ queryKey: queryKeys.promotions.list(auth.sessionId, "product-choices", { page, admin }), meta: { requiresAuth: true },
    service: (signal) => admin ? getProducts({ page, size: 10 }, { signal }) : getSellerProducts(page, {}, { context: auth.requestContext, signal }) }, { retry: false });
  return <div className="space-y-3"><p className="text-sm font-medium">Choose {admin ? "catalog" : "your shop"} products · {selected.length}/500 selected</p><AdminError error={result.error} onRetry={() => void result.refetch()} />{result.isPending && <p role="status" className="text-sm">Loading products…</p>}
    {result.data?.content.map((product) => <label key={product.id} className="flex min-h-11 items-center gap-3 rounded-sm border border-border p-3 text-sm"><input type="checkbox" checked={selected.includes(product.id)} disabled={!selected.includes(product.id) && selected.length >= 500} onChange={(e) => onChange(e.target.checked ? [...selected, product.id] : selected.filter((id) => id !== product.id))} /><span className="min-w-0 break-words">{product.name}</span></label>)}
    <div className="flex flex-wrap items-center gap-3 text-xs"><button type="button" className={sellerButton} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous products</button><span>Page {page + 1}</span><button type="button" className={sellerButton} disabled={!result.data || page + 1 >= result.data.totalPages} onClick={() => setPage(page + 1)}>Next products</button></div>
  </div>;
}
export default VoucherProductChoices;
