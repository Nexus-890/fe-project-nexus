"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useSeller } from "./SellerLayout";
import { useAuth } from "../hooks/useAuth";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { queryKeys } from "../configs/queryKeys";
import { canPublishSellerProduct, changeSellerProductStatus, getSellerAvailableTotal, getSellerPriceRange, getSellerProductListings } from "../service/sellerService";
import { getCategoryTree } from "../service/catalogService";
import { formatVND } from "../components/formatPrice";
import ProductImage from "../components/ProductImage";
import { SellerError, SellerHeading, SellerStatus, SellerTabs, sellerButton, sellerInput, sellerPrimary } from "../components/SellerUi";
import type { SellerProductListing, SellerProductStatus } from "../types/sellerType";

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
  const { preview, base, products, setProducts } = useSeller();
  const router = useRouter();
  const auth = useAuth();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("All");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("default");
  const [notice, setNotice] = useState("");
  const result = useApiQuery({ queryKey: queryKeys.seller.listings(auth.sessionId, page), meta: { requiresAuth: true }, service: (signal) => getSellerProductListings(page, { context: auth.requestContext, signal }) }, { enabled: !preview, retry: false });
  const categories = useApiQuery({ queryKey: queryKeys.catalog.tree, service: (signal) => getCategoryTree({ signal }) }, { enabled: !preview });
  const statusMutation = useApiMutation({ execute: ({ id, status }: { id: string; status: SellerProductStatus }) => changeSellerProductStatus(id, status, { context: auth.requestContext }), isCurrent: () => auth.isSessionCurrent(auth.sessionId), invalidateKey: [queryKeys.seller.all(auth.sessionId), ["catalog", "products"], ["catalog", "product"]] }, { onSuccess: () => setNotice("Product status updated.") });
  const source: SellerProductListing[] = preview ? products.map((product) => ({ ...product, ...getSellerPriceRange(product.skus) })) : result.data?.content ?? [];
  const rows = source.filter((row) => (tab === "All" || row.status === tab.toUpperCase()) && (!category || row.categoryId === category) && row.name.toLowerCase().includes(search.toLowerCase()));
  if (sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name));
  const totalPages = preview ? Math.ceil(rows.length / 5) : result.data?.totalPages ?? 0;
  const shown = preview ? rows.slice(page * 5, (page + 1) * 5) : rows;
  const updateStatus = (product: SellerProductListing, status: SellerProductStatus) => {
    if (status === "ACTIVE" && !canPublishSellerProduct(product)) return;
    const id = product.id;
    if (preview) { setProducts((current) => current.map((row) => row.id === id ? { ...row, status } : row)); setNotice("Preview status changed locally."); }
    else statusMutation.mutate({ id, status });
  };
  return <>
    <SellerHeading title="Products" description={`${preview ? products.length : result.data?.totalElements ?? "—"} products`}><Link href={`${base}/products/new`} className={sellerPrimary}><Plus size={16} aria-hidden="true" />New Product</Link></SellerHeading>
    <SellerTabs values={["All", "Active", "Draft", "Inactive"]} selected={tab} change={(value) => { setTab(value); setPage(0); }} />
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_190px]"><label className="relative"><Search aria-hidden="true" size={16} className="absolute left-3 top-3.5 text-muted-foreground" /><span className="sr-only">Search products on this page</span><input className={`${sellerInput} pl-9`} placeholder="Search products on this page" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></label><select aria-label="Category on this page" value={category} onChange={(event) => { setCategory(event.target.value); setPage(0); }} className={sellerInput}><option value="">All categories</option>{preview ? <option value="sample-audio">Audio</option> : categories.data?.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select><select aria-label="Sort this page" value={sort} onChange={(event) => setSort(event.target.value)} className={sellerInput}><option value="default">Original order</option><option value="name">Name: A–Z</option></select></div>
    {!preview && <p className="text-xs text-muted-foreground">Search, category and sort apply to the current page. The API supports page and size only. Stock sums all warehouse balances for each Active product. Draft and Inactive stock ownership reads are unavailable until the product is published.</p>}
    {notice && <p role="status" className="text-sm text-success">{notice}</p>}{statusMutation.error && <p role="alert" className="text-sm text-danger">{statusMutation.error.detail || statusMutation.error.title}</p>}
    {!preview && result.isPending ? <p role="status">Loading your products…</p> : !preview && result.error ? <SellerError error={result.error} retry={() => void result.refetch()} /> : <>
      {shown.length ? <div className="overflow-x-auto rounded-sm border border-border"><table className="w-full min-w-[660px] text-left text-sm"><caption className="sr-only">Seller products</caption><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Product", "Status", "Price range", "Stock", ...(preview ? ["Sold"] : []), "Actions"].map((name) => <th key={name} scope="col" className="px-4 py-3 font-normal">{name}</th>)}</tr></thead><tbody>{shown.map((row) => <tr key={row.id} tabIndex={0} aria-label={`Open ${row.name}`} onClick={(event) => { if (!(event.target instanceof HTMLElement) || !event.target.closest("a,button")) router.push(`${base}/products/${encodeURIComponent(row.id)}`); }} onKeyDown={(event) => { if (event.key === "Enter" && event.target === event.currentTarget) router.push(`${base}/products/${encodeURIComponent(row.id)}`); }} className="cursor-pointer border-t border-border"><th scope="row" className="max-w-80 px-4 py-4 font-normal"><div className="flex min-w-0 items-center gap-3"><div className="size-12 shrink-0 overflow-hidden rounded-sm bg-muted"><ProductImage compact src={row.images?.[0]?.imageUrl} alt={row.name} productName={row.name} /></div><div className="min-w-0"><Link href={`${base}/products/${encodeURIComponent(row.id)}`} className="break-words font-medium hover:text-primary">{row.name}</Link>{preview && <p className="mt-1 text-xs text-muted-foreground">{products.find((product) => product.id === row.id)?.skus.length} SKUs</p>}</div></div></th><td className="px-4 py-4"><SellerStatus>{row.status ?? "Unknown"}</SellerStatus></td><td className="px-4 py-4 font-mono">{row.minPrice === null ? "No price" : row.maxPrice && row.maxPrice !== row.minPrice ? `${formatVND(row.minPrice)} – ${formatVND(row.maxPrice)}` : formatVND(row.minPrice)}</td><td className="px-4 py-4 font-mono">{preview ? products.find((product) => product.id === row.id)?.stock : <ProductStock product={row} />}</td>{preview && <><td className="px-4 py-4 font-mono">{products.find((product) => product.id === row.id)?.sold}</td></>}<td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Link href={`${base}/products/${encodeURIComponent(row.id)}`} className={sellerButton}>Edit</Link><button type="button" className={sellerButton} disabled={statusMutation.isPending || row.status !== "ACTIVE" && !canPublishSellerProduct(row)} title={row.status !== "ACTIVE" && !canPublishSellerProduct(row) ? "Save a SKU and upload an image before publishing" : undefined} onClick={() => updateStatus(row, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>{row.status === "ACTIVE" ? "Deactivate" : "Activate"}</button></div></td></tr>)}</tbody></table></div> : <p role="status" className="rounded-sm border border-border p-8 text-center text-muted-foreground">No products match these filters.</p>}
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm"><p className="text-muted-foreground">Page {page + 1} · {preview ? rows.length : result.data?.totalElements ?? 0} products</p><nav aria-label="Product pagination" className="flex gap-2"><button type="button" className={sellerButton} disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" className={sellerButton} disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></nav></div>
    </>}
  </>;
}
export default SellerProductsPage;
