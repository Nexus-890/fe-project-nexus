"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload } from "lucide-react";
import { useSeller } from "./SellerLayout";
import { useAuth } from "../hooks/useAuth";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { queryKeys } from "../configs/queryKeys";
import { getCategoryTree } from "../service/catalogService";
import { canPublishSellerProduct, changeSellerProductStatus, deleteSellerProduct, getSellerProduct, getSellerStock, removeSellerImage, saveSellerProduct, saveSellerSku, uploadSellerImage } from "../service/sellerService";
import ProductImage from "../components/ProductImage";
import { formatVND } from "../components/formatPrice";
import { SellerError, SellerHeading, SellerPanel, sellerButton, sellerInput, sellerPrimary } from "../components/SellerUi";
import type { ProductDetail, ProductImage as ProductImageModel, ProductSku } from "../types/catalogResponseType";
import type { SellerProductStatus, SellerSkuInput } from "../types/sellerType";

function SkuEditor({ sku, productId, onSaved, onRemove }: { sku: ProductSku; productId: string | null; onSaved: (sku: ProductSku) => void; onRemove?: () => void }) {
  const { preview } = useSeller(); const auth = useAuth();
  const [input, setInput] = useState({ color: sku.color ?? "", size: sku.size ?? "", price: sku.price });
  const [notice, setNotice] = useState("");
  const save = useApiMutation({ execute: (body: SellerSkuInput) => saveSellerSku(productId!, sku.id.startsWith("new-") ? null : sku.id, body, { context: auth.requestContext }), isCurrent: () => auth.isSessionCurrent(auth.sessionId), invalidateKey: [queryKeys.seller.all(auth.sessionId), ["catalog", "products"], ["catalog", "product"]] }, { onSuccess: (savedSku) => { onSaved(savedSku); setNotice("SKU saved."); } });
  return <form className="grid gap-3 border-t border-border py-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]" onSubmit={(event) => {
    event.preventDefault(); setNotice("");
    const price = Number(input.price);
    if (!/^\d+(?:\.\d{1,2})?$/.test(input.price) || !Number.isFinite(price) || price <= 0 || price > Number.MAX_SAFE_INTEGER / 100) { setNotice("Enter a positive price with at most two decimals and within the supported safe range."); return; }
    if (preview) { onSaved({ ...sku, ...input, skuCode: sku.skuCode || `SAMPLE-${sku.id.slice(-8)}` }); setNotice("SKU saved in preview. Its sample code is local only."); } else save.mutate({ ...input, price });
  }}>
    <label className="text-xs text-muted-foreground">{preview ? "Sample SKU code" : "SKU code"}<input aria-label={`SKU code ${sku.skuCode || "new SKU"}`} readOnly value={sku.skuCode || (preview ? "Assigned in sample preview" : "Generated when saved")} className={`${sellerInput} mt-2 bg-muted font-mono text-xs`} /></label>
    {(["color", "size", "price"] as const).map((key) => <label key={key} className="text-xs text-muted-foreground">{key === "price" ? "Price (VND)" : key === "color" ? "Color" : "Size"}<input aria-label={`${key} ${sku.skuCode || "new SKU"}`} required maxLength={key === "price" ? 17 : 50} value={input[key]} inputMode={key === "price" ? "decimal" : undefined} onChange={(event) => setInput({ ...input, [key]: event.target.value })} className={`${sellerInput} mt-2`} /></label>)}
    <div className="flex items-end gap-2"><button type="submit" className={sellerButton} disabled={save.isPending || !preview && !productId}>{save.isPending ? "Saving…" : "Save SKU"}</button>{onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${sku.skuCode || "new SKU"} locally`} className={sellerButton}><Trash2 size={16} aria-hidden="true" /></button>}</div>
    {(notice || save.error) && <p role={save.error ? "alert" : "status"} className="col-span-full text-xs text-muted-foreground">{save.error?.detail || notice}</p>}
  </form>;
}

function ProductEditor({ initial, newProduct }: { initial: ProductDetail; newProduct: boolean }) {
  const { preview, base, setProducts } = useSeller(); const auth = useAuth();
  const router = useRouter(); const queryClient = useQueryClient();
  const [id, setId] = useState<string | null>(newProduct ? null : initial.id);
  const [name, setName] = useState(initial.name); const [description, setDescription] = useState(initial.description ?? "");
  const [category, setCategory] = useState(initial.categoryId ?? ""); const [auctionEnable, setAuctionEnable] = useState(initial.auctionEnable);
  const [status, setStatus] = useState((initial.status ?? "DRAFT") as SellerProductStatus);
  const [savedStatus, setSavedStatus] = useState(status);
  const [skus, setSkus] = useState(initial.skus); const [images, setImages] = useState(initial.images);
  const [notice, setNotice] = useState(""); const [deleteOpen, setDeleteOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const categories = useApiQuery({ queryKey: queryKeys.catalog.tree, service: (signal) => getCategoryTree({ signal }) }, { enabled: !preview });
  const stock = useApiQuery({ queryKey: [...queryKeys.seller.inventory(auth.sessionId, 0), id, skus.map((sku) => sku.id)], meta: { requiresAuth: true }, service: (signal) => getSellerStock(skus.filter((sku) => !sku.id.startsWith("new-")).map((sku) => sku.id), { signal }) }, { enabled: !preview && skus.length > 0 });
  const save = useApiMutation({ execute: () => saveSellerProduct(id, { name: name.trim(), description, categoryId: category, auctionEnable }, { context: auth.requestContext }), isCurrent: () => auth.isSessionCurrent(auth.sessionId), invalidateKey: [queryKeys.seller.all(auth.sessionId), ["catalog", "products"], ["catalog", "product"]] }, { onSuccess: (product) => {
    const created = id === null;
    setId(product.id); setSavedStatus((product.status ?? "DRAFT") as SellerProductStatus); setStatus((product.status ?? "DRAFT") as SellerProductStatus);
    setNotice("Basic information saved to the server. SKU and image actions save separately.");
    if (created) {
      queryClient.setQueryData([...queryKeys.seller.all(auth.sessionId), "product", product.id], { ...initial, ...product, description, categoryId: category, auctionEnable, skus: [], images: [] });
      router.replace(`${base}/products/${encodeURIComponent(product.id)}`);
    }
  } });
  const publishReady = canPublishSellerProduct({ skus, images });
  const statusSave = useApiMutation({ execute: (target: SellerProductStatus) => {
    if (target === "ACTIVE" && !publishReady) throw { kind: "invalid-response", status: 0, title: "Add at least one saved SKU and image before publishing." };
    return changeSellerProductStatus(id!, target, { context: auth.requestContext });
  }, isCurrent: () => auth.isSessionCurrent(auth.sessionId), invalidateKey: [queryKeys.seller.all(auth.sessionId), ["catalog", "products"], ["catalog", "product"]] }, { onSuccess: (product) => { setSavedStatus(product.status as SellerProductStatus); setStatus(product.status as SellerProductStatus); setNotice("Product status updated."); } });
  const imageSave = useApiMutation({ execute: (file: File) => uploadSellerImage(id!, file, { context: auth.requestContext }), isCurrent: () => auth.isSessionCurrent(auth.sessionId), invalidateKey: [queryKeys.seller.all(auth.sessionId), ["catalog", "products"], ["catalog", "product"]] }, { onSuccess: (image) => { setImages((current) => [...current, image]); setNotice("Image uploaded through the backend."); } });
  const imageRemove = useApiMutation({ execute: (image: ProductImageModel) => removeSellerImage(id!, image.id, { context: auth.requestContext }), isCurrent: () => auth.isSessionCurrent(auth.sessionId), invalidateKey: [queryKeys.seller.all(auth.sessionId), ["catalog", "products"], ["catalog", "product"]] }, { onSuccess: (_, image) => setImages((current) => current.filter((row) => row.id !== image.id)) });
  const deletion = useApiMutation({ execute: () => deleteSellerProduct(id!, { context: auth.requestContext }), isCurrent: () => auth.isSessionCurrent(auth.sessionId), invalidateKey: [queryKeys.seller.all(auth.sessionId), ["catalog", "products"], ["catalog", "product"]] }, { onSuccess: () => { setDeleteOpen(false); setNotice("Product deleted. Return to Products."); } });
  const error = save.error || statusSave.error || imageSave.error || imageRemove.error || deletion.error;
  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault(); setNotice("");
    if (!preview) { save.mutate(); return; }
    const nextId = id ?? `sample-product-${crypto.randomUUID()}`;
    setProducts((current) => {
      const previous = current.find((row) => row.id === nextId);
      const updated = { ...initial, id: nextId, name, description, categoryId: category, auctionEnable, status, images, skus, minPrice: skus[0]?.price ?? null, stock: previous?.stock ?? 0, reserved: previous?.reserved ?? 0, unavailable: previous?.unavailable ?? 0, sold: previous?.sold ?? 0, updated: "2026-11-11" };
      return previous ? current.map((row) => row.id === nextId ? updated : row) : [...current, updated];
    }); setId(nextId); setSavedStatus(status); setNotice("Product saved in this sample preview. No server data changed.");
  };
  return <>
    <Link href={`${base}/products`} className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-primary">Products / {name || "New product"}</Link>
    <SellerHeading title={newProduct ? "New Product" : "Edit Product"} description={preview ? "Edit a local sample listing." : "Basic information, SKUs, status and images save separately."}><button type="submit" form="seller-product-form" className={sellerPrimary} disabled={save.isPending || deletion.isSuccess}>{save.isPending ? "Saving…" : preview ? "Save Preview" : "Save Changes"}</button></SellerHeading>
    {notice && <p role="status" className="text-sm text-success">{notice}</p>}{error && <p role="alert" className="text-sm text-danger">{error.detail || error.title}</p>}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <SellerPanel title="Basic Information"><form id="seller-product-form" onSubmit={onSubmit} className="space-y-5"><label className="block text-sm">Product Name<input required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} className={`${sellerInput} mt-2`} /></label><label className="block text-sm">Category<select aria-label="Category" required value={category} onChange={(event) => setCategory(event.target.value)} className={`${sellerInput} mt-2`}><option value="">Select category</option>{preview ? <option value="sample-audio">Electronics / Audio</option> : categories.data?.flatMap((root) => [root, ...root.children, ...root.children.flatMap((child) => child.children)]).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>{categories.error && <p role="alert" className="text-sm text-danger">Categories could not be loaded. <button type="button" onClick={() => void categories.refetch()} className="underline">Retry categories</button></p>}<label className="block text-sm">Description<textarea rows={5} value={description} onChange={(event) => setDescription(event.target.value)} className={`${sellerInput} mt-2`} /></label></form></SellerPanel>
        <SellerPanel title="Media"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{images.map((image, index) => <div key={image.id} className="min-w-0"><div className="aspect-square overflow-hidden rounded-sm bg-muted"><ProductImage src={image.imageUrl} alt={`${name} ${index + 1}`} productName={name} /></div><button type="button" className={`${sellerButton} mt-2 w-full`} disabled={imageRemove.isPending} onClick={() => preview ? setImages((current) => current.filter((row) => row.id !== image.id)) : imageRemove.mutate(image)}>Remove</button></div>)}<button type="button" className="flex aspect-square min-h-24 flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-input p-3 text-sm disabled:opacity-50" disabled={images.length >= 5 || imageSave.isPending || !preview && !id} onClick={() => fileInput.current?.click()}><Upload size={20} aria-hidden="true" />{imageSave.isPending ? "Uploading…" : "Add Image"}</button></div><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Product image file" onChange={(event) => {
          const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setNotice("Choose a JPEG, PNG or WebP image up to 5 MiB."); return; }
          if (!preview) imageSave.mutate(file); else { const reader = new FileReader(); reader.onload = () => setImages((current) => [...current, { id: crypto.randomUUID(), imageUrl: String(reader.result), sortOrder: current.length }]); reader.readAsDataURL(file); }
        }} /><p className="mt-3 text-xs text-muted-foreground">Up to 5 images, JPEG/PNG/WebP, 5 MiB each. {!id && "Save basic information before uploading."}</p></SellerPanel>
        <SellerPanel title="Pricing & SKUs">{skus.map((sku) => <SkuEditor key={sku.id} sku={sku} productId={id} onSaved={(updated) => setSkus((current) => current.map((row) => row.id === sku.id ? updated : row))} onRemove={preview || sku.id.startsWith("new-") ? () => setSkus((current) => current.filter((row) => row.id !== sku.id)) : undefined} />)}<button type="button" className={`${sellerButton} mt-4`} onClick={() => setSkus((current) => [...current, { id: `new-${crypto.randomUUID()}`, productId: id ?? "", skuCode: "", color: "", size: "Standard", price: "", status: "ACTIVE" }])}><Plus size={16} aria-hidden="true" />Add SKU</button>{!preview && <p className="mt-3 text-xs text-muted-foreground">SKU deletion is unavailable. Stock is read-only: {stock.isError ? "unavailable" : stock.isPending && skus.length ? "loading…" : stock.data?.map((row) => `${skus.find((sku) => sku.id === row.skuId)?.skuCode}: ${row.available}`).join(" · ") || "no stock records"}. Inventory changes require an admin.</p>}</SellerPanel>
      </div>
      <aside className="space-y-6"><SellerPanel title="Status"><fieldset className="space-y-3"><legend className="sr-only">Product status</legend>{(["DRAFT", "ACTIVE", "INACTIVE"] as const).map((value) => <label key={value} className="flex min-h-9 items-center gap-3 text-sm"><input type="radio" name="product-status" value={value} checked={status === value} disabled={!preview && (value === "DRAFT" || !id)} onChange={() => setStatus(value)} />{value[0] + value.slice(1).toLowerCase()}</label>)}</fieldset>{!preview && (base === "/backoffice" ? <button type="button" className={`${sellerPrimary} mt-3 w-full`} disabled={!id || statusSave.isPending || savedStatus !== "ACTIVE" && !publishReady} onClick={() => statusSave.mutate(savedStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>{statusSave.isPending ? "Updating..." : savedStatus === "ACTIVE" ? "Unpublish" : "Publish"}</button> : <button type="button" className={`${sellerButton} mt-3 w-full`} disabled={!id || status === savedStatus || statusSave.isPending || status === "ACTIVE" && !publishReady} onClick={() => statusSave.mutate(status)}>{statusSave.isPending ? "Updating..." : "Apply status"}</button>)}{!preview && !publishReady && <p className="mt-3 text-xs leading-5 text-muted-foreground">Save at least one SKU and upload an image before publishing. Unsaved SKU rows do not count.</p>}<label className="mt-5 flex items-center gap-3 border-t border-border pt-4 text-sm"><input type="checkbox" checked={auctionEnable} onChange={(event) => setAuctionEnable(event.target.checked)} />Allow auction listings</label><p className="mt-3 text-xs leading-5 text-muted-foreground">Auction eligibility and stock reservations require backend validation.</p></SellerPanel><SellerPanel title="Listing Preview"><div className="aspect-square overflow-hidden rounded-sm bg-muted"><ProductImage src={images[0]?.imageUrl} alt={name} productName={name || "New product"} /></div><h3 className="mt-4 break-words text-sm font-medium">{name || "New product"}</h3><p className="mt-2 font-mono text-primary">{skus[0]?.price ? formatVND(skus[0].price) : "No price yet"}</p><p className="mt-2 text-xs text-muted-foreground">Unsaved listing preview</p></SellerPanel><SellerPanel title="Delete Product"><p className="text-xs leading-5 text-muted-foreground">Products with orders cannot be deleted. Set them to Inactive instead.</p><button type="button" disabled={!id || deletion.isPending || deletion.isSuccess} onClick={() => setDeleteOpen((value) => !value)} className={`${sellerButton} mt-4 text-danger`}>Delete Product</button>{deleteOpen && <div className="mt-4 space-y-3"><p className="text-sm">Confirm deletion of this product?</p><button type="button" className={`${sellerButton} text-danger`} onClick={() => {
          if (preview) { setProducts((current) => current.filter((row) => row.id !== id)); setDeleteOpen(false); setNotice("Product removed from this preview. Return to Products."); setId(null); } else deletion.mutate();
        }}>Confirm delete</button><button type="button" className={sellerButton} onClick={() => setDeleteOpen(false)}>Keep product</button></div>}</SellerPanel></aside>
    </div>
  </>;
}

function SellerProductEditorPage({ productId = "new" }: { productId?: string }) {
  const { preview, products, base } = useSeller(); const auth = useAuth();
  const detail = useApiQuery({ queryKey: [...queryKeys.seller.all(auth.sessionId), "product", productId], meta: { requiresAuth: true }, service: (signal) => getSellerProduct(productId, { context: auth.requestContext, signal }) }, { enabled: !preview && productId !== "new", retry: false });
  const initial = preview ? products.find((row) => row.id === productId) : detail.data;
  if (productId === "new") return <ProductEditor key="new" newProduct initial={{ id: "", name: "", slug: "", sellerId: "", categoryId: "", status: "DRAFT", description: "", auctionEnable: false, skus: [], images: [], minPrice: null, maxPrice: null }} />;
  if (!preview && detail.isPending) return <p role="status">Loading product…</p>;
  if (!preview && detail.error) return <><SellerHeading title="Product details unavailable" description="The owner detail endpoint requires your seller account and product ownership." /><SellerError error={detail.error} retry={() => void detail.refetch()} /><Link href={`${base}/products`} className={sellerButton}>Return to products</Link></>;
  if (!initial || !preview && initial.sellerId !== auth.user?.id) return <p role="alert">This product is not available in your workspace.</p>;
  return <ProductEditor key={`${auth.sessionId}:${productId}`} initial={initial} newProduct={false} />;
}
export default SellerProductEditorPage;
