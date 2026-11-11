"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Upload } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { queryKeys } from "../configs/queryKeys";
import { getCategoryTree } from "../service/catalogService";
import { canPublishSellerProduct, changeSellerProductStatus, createSellerProduct, createSellerSku, getSellerProduct, removeSellerImage, uploadSellerImage } from "../service/sellerService";
import ProductImage from "../components/ProductImage";
import { formatVND } from "../components/formatPrice";
import { SellerError, SellerHeading, SellerPanel, sellerButton, sellerInput, sellerPrimary } from "../components/SellerUi";
import type { ProductDetail, ProductImage as ProductImageModel, ProductSku } from "../types/catalogResponseType";
import type { SellerProductStatus, SellerSkuInput } from "../types/sellerType";

function NewSkuForm({ productId, onSaved, onRemove }: { productId: string; onSaved: (sku: ProductSku) => void; onRemove: () => void }) {
  const auth = useAuth();
  const [input, setInput] = useState({ color: "", size: "Standard", price: "" });
  const [validation, setValidation] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const save = useApiMutation({
    execute: (body: SellerSkuInput) => {
      const controller = new AbortController(); pending.current = controller;
      return createSellerSku(productId, body, { context: auth.requestContext, signal: controller.signal });
    },
    isCurrent: () => auth.isSessionCurrent(auth.sessionId) && pending.current?.signal.aborted !== true,
    invalidateKey: [queryKeys.seller.all(auth.sessionId), ["catalog", "products"], ["catalog", "product"]],
  }, { onSuccess: onSaved });
  return <form className="space-y-4 border-t border-border py-5" onSubmit={(event) => {
    event.preventDefault(); setValidation("");
    const price = Number(input.price);
    if (!/^\d+(?:\.\d{1,2})?$/.test(input.price) || !Number.isFinite(price) || price <= 0 || price > Number.MAX_SAFE_INTEGER / 100) { setValidation("Enter a positive price with at most two decimals within the supported range."); return; }
    save.mutate({ ...input, price });
  }}>
    <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs text-muted-foreground">SKU code<input aria-label="SKU code new SKU" readOnly value="Generated when saved" className={`${sellerInput} mt-2 bg-muted font-mono text-xs`} /></label>
      {(["color", "size", "price"] as const).map((key) => <label key={key} className="text-xs text-muted-foreground">{key === "price" ? "Price (VND)" : key === "color" ? "Color" : "Size"}<input aria-label={`${key} new SKU`} required maxLength={key === "price" ? 17 : 50} value={input[key]} inputMode={key === "price" ? "decimal" : undefined} onChange={(event) => setInput({ ...input, [key]: event.target.value })} className={`${sellerInput} mt-2`} /></label>)}
    </fieldset>
    <div className="flex flex-wrap gap-2"><button type="submit" className={sellerButton} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save SKU"}</button><button type="button" className={sellerButton} disabled={save.isPending} onClick={onRemove}>Cancel SKU</button></div>
    {(validation || save.error) && <p role="alert" className="text-sm text-danger">{save.error?.detail || save.error?.title || validation}</p>}
  </form>;
}

function SavedSku({ sku }: { sku: ProductSku }) {
  return <div className="grid gap-3 border-t border-border py-4 sm:grid-cols-2 xl:grid-cols-4">
    <label className="text-xs text-muted-foreground">SKU code<input aria-label={`SKU code ${sku.skuCode}`} readOnly value={sku.skuCode} className={`${sellerInput} mt-2 bg-muted font-mono text-xs`} /></label>
    <div><p className="text-xs text-muted-foreground">Color</p><p className="mt-3 break-words text-sm">{sku.color || "—"}</p></div>
    <div><p className="text-xs text-muted-foreground">Size</p><p className="mt-3 break-words text-sm">{sku.size || "—"}</p></div>
    <div><p className="text-xs text-muted-foreground">Price</p><p className="mt-3 font-mono text-sm">{formatVND(sku.price)}</p></div>
  </div>;
}

function ProductEditor({ initial, newProduct }: { initial: ProductDetail; newProduct: boolean }) {
  const auth = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [category, setCategory] = useState(initial.categoryId ?? "");
  const [auctionEnable, setAuctionEnable] = useState(initial.auctionEnable);
  const [status, setStatus] = useState((initial.status ?? "DRAFT") as SellerProductStatus);
  const [skus, setSkus] = useState(initial.skus);
  const [images, setImages] = useState(initial.images);
  const [skuForms, setSkuForms] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const requestOptions = () => {
    const controller = new AbortController(); pending.current = controller;
    return { context: auth.requestContext, signal: controller.signal };
  };
  const isCurrent = () => auth.isSessionCurrent(auth.sessionId) && pending.current?.signal.aborted !== true;
  const invalidateKey = [queryKeys.seller.all(auth.sessionId), ["catalog", "products"], ["catalog", "product"]];
  const categories = useApiQuery({ queryKey: queryKeys.catalog.tree, service: (signal) => getCategoryTree({ signal }) });
  const save = useApiMutation({ execute: () => createSellerProduct({ name: name.trim(), description, categoryId: category, auctionEnable }, requestOptions()), isCurrent, invalidateKey }, {
    onSuccess: (product) => {
      queryClient.setQueryData([...queryKeys.seller.all(auth.sessionId), "product", product.id], { ...initial, ...product, description, categoryId: category, auctionEnable, skus: [], images: [] });
      router.replace(`/backoffice/products/${encodeURIComponent(product.id)}`);
    },
  });
  const publishReady = canPublishSellerProduct({ skus, images });
  const statusSave = useApiMutation({ execute: (target: SellerProductStatus) => {
    if (target === "ACTIVE" && !publishReady) throw { kind: "invalid-response", status: 0, title: "Add at least one saved SKU and image before publishing." };
    return changeSellerProductStatus(initial.id, target, requestOptions());
  }, isCurrent, invalidateKey }, { onSuccess: (product) => { setStatus(product.status as SellerProductStatus); setNotice("Product status updated."); } });
  const imageSave = useApiMutation({ execute: (file: File) => uploadSellerImage(initial.id, file, requestOptions()), isCurrent, invalidateKey }, { onSuccess: (image) => { setImages((current) => [...current, image]); setNotice("Image uploaded through the backend."); } });
  const imageRemove = useApiMutation({ execute: (image: ProductImageModel) => removeSellerImage(initial.id, image.id, requestOptions()), isCurrent, invalidateKey }, { onSuccess: (_, image) => { setImages((current) => current.filter((row) => row.id !== image.id)); setNotice("Image removed."); } });
  const busy = save.isPending || statusSave.isPending || imageSave.isPending || imageRemove.isPending;
  const error = save.error || statusSave.error || imageSave.error || imageRemove.error;

  return <>
    <Link href="/backoffice/products" className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-primary">Products / {name || "New product"}</Link>
    <SellerHeading title={newProduct ? "New Product" : "Edit Product"} description={newProduct ? "Create a draft before adding SKUs and images." : "Manage this product’s SKUs, images and publication."}>{newProduct && <button type="submit" form="seller-product-form" className={sellerPrimary} disabled={busy}>{save.isPending ? "Saving…" : "Save Changes"}</button>}</SellerHeading>
    {notice && <p role="status" className="text-sm text-success">{notice}</p>}{error && <p role="alert" className="text-sm text-danger">{error.detail || error.title}</p>}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-6">
        <SellerPanel title="Basic Information"><form id="seller-product-form" onSubmit={(event) => { event.preventDefault(); if (newProduct && !busy) save.mutate(); }} className="space-y-5">
          <label className="block text-sm">Product Name<input required readOnly={!newProduct} maxLength={255} value={name} onChange={(event) => setName(event.target.value)} className={`${sellerInput} mt-2`} /></label>
          <label className="block text-sm">Category<select aria-label="Category" required disabled={!newProduct || categories.isPending || busy} value={category} onChange={(event) => setCategory(event.target.value)} className={`${sellerInput} mt-2`}><option value="">Select category</option>{categories.data?.flatMap((root) => [root, ...root.children, ...root.children.flatMap((child) => child.children)]).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          {categories.isPending && <p role="status" className="text-sm text-muted-foreground">Loading categories…</p>}
          {categories.error && <p role="alert" className="text-sm text-danger">Categories could not be loaded. <button type="button" onClick={() => void categories.refetch()} className="underline">Retry categories</button></p>}
          <label className="block text-sm">Description<textarea rows={5} readOnly={!newProduct} value={description} onChange={(event) => setDescription(event.target.value)} className={`${sellerInput} mt-2`} /></label>
          {newProduct && <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={auctionEnable} onChange={(event) => setAuctionEnable(event.target.checked)} />Allow auction listings</label>}
        </form></SellerPanel>
        {!newProduct && <>
          <SellerPanel title="Media"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{images.map((image, index) => <div key={image.id} className="min-w-0"><div className="aspect-square overflow-hidden rounded-sm bg-muted"><ProductImage src={image.imageUrl} alt={`${name} ${index + 1}`} productName={name} /></div><button type="button" className={`${sellerButton} mt-2 w-full`} disabled={busy} onClick={() => imageRemove.mutate(image)}>Remove</button></div>)}<button type="button" className="flex aspect-square min-h-24 flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-input p-3 text-sm disabled:opacity-50" disabled={images.length >= 5 || busy} onClick={() => fileInput.current?.click()}><Upload size={20} aria-hidden="true" />{imageSave.isPending ? "Uploading…" : "Add Image"}</button></div>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Product image file" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setNotice("Choose a JPEG, PNG or WebP image up to 5 MiB."); return; } imageSave.mutate(file); }} /><p className="mt-3 text-xs text-muted-foreground">Up to 5 images, JPEG/PNG/WebP, 5 MiB each.</p>
          </SellerPanel>
          <SellerPanel title="Pricing & SKUs">{skus.map((sku) => <SavedSku key={sku.id} sku={sku} />)}{skuForms.map((key) => <NewSkuForm key={key} productId={initial.id} onSaved={(sku) => { setSkus((current) => [...current, sku]); setSkuForms((current) => current.filter((row) => row !== key)); setNotice("SKU saved."); }} onRemove={() => setSkuForms((current) => current.filter((row) => row !== key))} />)}<button type="button" className={`${sellerButton} mt-4`} onClick={() => setSkuForms((current) => [...current, crypto.randomUUID()])}><Plus size={16} aria-hidden="true" />Add SKU</button></SellerPanel>
        </>}
      </div>
      <aside><SellerPanel title="Status"><p className="font-medium">{status}</p>{!newProduct && <button type="button" className={`${sellerPrimary} mt-4 w-full`} disabled={busy || status !== "ACTIVE" && !publishReady} onClick={() => statusSave.mutate(status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>{statusSave.isPending ? "Updating…" : status === "ACTIVE" ? "Unpublish" : "Publish"}</button>}{!newProduct && !publishReady && <p className="mt-3 text-xs leading-5 text-muted-foreground">Save at least one SKU and upload an image before publishing. Unsaved SKU rows do not count.</p>}</SellerPanel></aside>
    </div>
  </>;
}

function SellerProductEditorPage({ productId = "new" }: { productId?: string }) {
  const auth = useAuth();
  const detail = useApiQuery({ queryKey: [...queryKeys.seller.all(auth.sessionId), "product", productId], meta: { requiresAuth: true }, service: (signal) => getSellerProduct(productId, { context: auth.requestContext, signal }) }, { enabled: productId !== "new", retry: false });
  if (productId === "new") return <ProductEditor key="new" newProduct initial={{ id: "", name: "", slug: "", sellerId: "", categoryId: "", status: "DRAFT", description: "", auctionEnable: false, skus: [], images: [], minPrice: null, maxPrice: null }} />;
  if (detail.isPending) return <p role="status">Loading product…</p>;
  if (detail.error) return <><SellerHeading title="Product details unavailable" /><SellerError error={detail.error} retry={() => void detail.refetch()} /><Link href="/backoffice/products" className={sellerButton}>Return to products</Link></>;
  if (!detail.data || detail.data.sellerId !== auth.user?.id) return <p role="alert">This product is not available in your workspace.</p>;
  return <ProductEditor key={`${auth.sessionId}:${productId}`} initial={detail.data} newProduct={false} />;
}

export default SellerProductEditorPage;
