"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useApiQuery } from "../hooks/useApi";
import { queryKeys } from "../configs/queryKeys";
import { getSellerAvailableTotal, getSellerProductListings } from "../service/sellerService";
import { formatVND } from "../components/formatPrice";
import ProductImage from "../components/ProductImage";
import { SellerError, SellerHeading, SellerStatus, sellerButton, sellerPrimary } from "../components/SellerUi";
import type { SellerProductListing } from "../types/sellerType";

function ProductStock({ product }: { product: SellerProductListing }) {
  const auth = useAuth();
  const ids = product.skus.map((sku) => sku.id);
  const result = useApiQuery({
    queryKey: queryKeys.seller.productBalances(auth.sessionId, product.id, ids), meta: { requiresAuth: true },
    service: (signal) => getSellerAvailableTotal(ids, { context: auth.requestContext, signal }),
  }, { enabled: product.status === "ACTIVE" && ids.length > 0, retry: false });
  if (!ids.length) return <span>0</span>;
  if (product.status !== "ACTIVE") return <span className="text-xs text-muted-foreground">Publish to view stock</span>;
  if (result.isPending) return <span role="status" className="text-xs">Loading…</span>;
  if (result.error) return <span className="text-xs"><span role="alert">{result.error.detail || "Stock unavailable"}</span><button type="button" className="ml-2 underline" onClick={() => void result.refetch()}>Retry stock</button></span>;
  return <span>{result.data}</span>;
}

function SellerProductsPage() {
  const router = useRouter();
  const auth = useAuth();
  const [page, setPage] = useState(0);
  const result = useApiQuery({ queryKey: queryKeys.seller.listings(auth.sessionId, page), meta: { requiresAuth: true }, service: (signal) => getSellerProductListings(page, { context: auth.requestContext, signal }) }, { retry: false });
  const rows = result.data?.content ?? [];
  const hrefFor = (id: string) => `/backoffice/products/${encodeURIComponent(id)}`;
  return <>
    <SellerHeading title="Products" description={`${result.data?.totalElements ?? "—"} products`}><Link href="/backoffice/products/new" className={sellerPrimary}><Plus size={16} aria-hidden="true" />New Product</Link></SellerHeading>
    <p className="text-xs text-muted-foreground">Stock sums warehouse balances for each Active product. Publish drafts before their stock ownership can be checked.</p>
    {result.isPending ? <p role="status">Loading your products…</p> : result.error ? <SellerError error={result.error} retry={() => void result.refetch()} /> : <>
      {rows.length ? <div className="overflow-x-auto rounded-sm border border-border"><table className="w-full min-w-[660px] text-left text-sm"><caption className="sr-only">Seller products</caption><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Product", "Status", "Price range", "Stock", "Action"].map((name) => <th key={name} scope="col" className="px-4 py-3 font-normal">{name}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} tabIndex={0} aria-label={`Open ${row.name}`} onClick={(event) => { if (!(event.target instanceof HTMLElement) || !event.target.closest("a,button")) router.push(hrefFor(row.id)); }} onKeyDown={(event) => { if (event.key === "Enter" && event.target === event.currentTarget) router.push(hrefFor(row.id)); }} className="cursor-pointer border-t border-border"><th scope="row" className="max-w-80 px-4 py-4 font-normal"><div className="flex min-w-0 items-center gap-3"><div className="size-12 shrink-0 overflow-hidden rounded-sm bg-muted"><ProductImage src={row.images[0]?.imageUrl} alt={row.name} productName={row.name} /></div><Link href={hrefFor(row.id)} className="min-w-0 break-words font-medium hover:text-primary">{row.name}</Link></div></th><td className="px-4 py-4"><SellerStatus>{row.status ?? "Unknown"}</SellerStatus></td><td className="px-4 py-4 font-mono">{row.minPrice === null ? "No price" : row.maxPrice && row.maxPrice !== row.minPrice ? `${formatVND(row.minPrice)} – ${formatVND(row.maxPrice)}` : formatVND(row.minPrice)}</td><td className="px-4 py-4 font-mono"><ProductStock product={row} /></td><td className="px-4 py-4"><Link href={hrefFor(row.id)} className={sellerButton}>Open</Link></td></tr>)}</tbody></table></div> : <p role="status" className="rounded-sm border border-border p-8 text-center text-muted-foreground">You have no products yet.</p>}
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm"><p className="text-muted-foreground">Page {page + 1} · {result.data?.totalElements ?? 0} products</p><nav aria-label="Product pagination" className="flex gap-2"><button type="button" className={sellerButton} disabled={page === 0 || result.isFetching} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" className={sellerButton} disabled={result.isFetching || page + 1 >= (result.data?.totalPages ?? 0)} onClick={() => setPage((value) => value + 1)}>Next</button></nav></div>
    </>}
  </>;
}
export default SellerProductsPage;
