"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Plus, Upload } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { queryKeys } from "../configs/queryKeys";
import { getCategoryTree, isValidShippingParcel } from "../service/catalogService";
import { getProductAvailability, intakeStock } from "../service/backofficeService";
import { canPublishSellerProduct, changeSellerProductStatus, createSellerProduct, deleteSellerProduct, getSellerProduct, removeSellerImage, reorderSellerImages, saveSellerSku, updateSellerProduct, uploadSellerImage } from "../service/sellerService";
import ProductImage from "../components/ProductImage";
import { formatVND } from "../components/formatPrice";
import { SellerError, SellerHeading, SellerPanel, sellerButton, sellerInput, sellerPrimary } from "../components/SellerUi";
import type { ProductDetail, ProductImage as ProductImageModel, ProductSku } from "../types/catalogResponseType";
import type { SellerProductStatus, SellerProductUpdate, SellerSkuInput } from "../types/sellerType";
import { MoneyInput, initialVnd } from "../components/moneyInput";

const parcelFields = [
  { key: "weightGrams", label: "Weight (g)", max: 50000 },
  { key: "lengthCm", label: "Length (cm)", max: 200 },
  { key: "widthCm", label: "Width (cm)", max: 200 },
  { key: "heightCm", label: "Height (cm)", max: 200 },
] as const;

const skuFields = [
  { key: "color", label: "Color", aria: "color", money: false },
  { key: "size", label: "Size", aria: "size", money: false },
  { key: "costPrice", label: "Cost price (VND)", aria: "cost price", money: true },
  { key: "price", label: "Selling price (VND)", aria: "price", money: true },
] as const;

const moneyOf = (text: string): number | null =>
  /^\d+(?:\.\d{1,2})?$/.test(text) && Number(text) <= Number.MAX_SAFE_INTEGER / 100 ? Number(text) : null;

function SkuEditor({ productId, sku, onSaved, onRemove }: { productId: string; sku?: ProductSku; onSaved: (sku: ProductSku) => void; onRemove: () => void }) {
  const auth = useAuth();
  const [input, setInput] = useState({
    color: sku?.color ?? "", size: sku?.size ?? "Standard", price: initialVnd(sku?.price), costPrice: initialVnd(sku?.costPrice),
    weightGrams: sku?.shippingParcel?.weightGrams.toString() ?? "",
    lengthCm: sku?.shippingParcel?.lengthCm.toString() ?? "",
    widthCm: sku?.shippingParcel?.widthCm.toString() ?? "",
    heightCm: sku?.shippingParcel?.heightCm.toString() ?? "",
  });
  const [validation, setValidation] = useState("");
  const pending = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const labelSuffix = sku?.skuCode ?? "new SKU";
  const hasMeasurements = parcelFields.some(({ key }) => input[key].trim() !== "");
  useEffect(() => () => pending.current?.abort(), []);
  const save = useApiMutation({
    execute: (body: SellerSkuInput) => {
      const controller = new AbortController(); pending.current = controller;
      return saveSellerSku(productId, sku?.id ?? null, body, { context: auth.requestContext, signal: controller.signal });
    },
    isCurrent: () => auth.isSessionCurrent(auth.sessionId) && pending.current?.signal.aborted !== true,
    invalidateKey: [queryKeys.seller.all(auth.sessionId), ["catalog", "products"], ["catalog", "product"]],
  }, { onSuccess: onSaved, onSettled: () => { submitting.current = false; } });
  return <form className="space-y-4 border-t border-border py-5" onSubmit={(event) => {
    event.preventDefault(); setValidation("");
    if (submitting.current || save.isPending) return;
    const price = moneyOf(input.price);
    if (price === null || price <= 0) { setValidation("Enter a positive selling price with at most two decimals within the supported range."); return; }
    const costPrice = moneyOf(input.costPrice);
    if (costPrice === null) { setValidation("Enter a cost price of zero or more with at most two decimals within the supported range."); return; }
    const shippingParcel = { weightGrams: Number(input.weightGrams), lengthCm: Number(input.lengthCm), widthCm: Number(input.widthCm), heightCm: Number(input.heightCm) };
    if ((!sku || hasMeasurements) && !isValidShippingParcel(shippingParcel)) {
      setValidation("Enter all four whole-number measurements: weight 1–50,000 g; length, width and height 1–200 cm."); return;
    }
    submitting.current = true;
    save.mutate({ color: input.color, size: input.size, price, costPrice, ...(!sku || hasMeasurements ? { shippingParcel } : {}) });
  }}>
    <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs text-muted-foreground">SKU code<input aria-label={`SKU code ${labelSuffix}`} readOnly value={sku?.skuCode ?? "Generated when saved"} className={`${sellerInput} mt-2 bg-muted font-mono text-xs`} /></label>
      {skuFields.map(({ key, label, aria, money }) => <label key={key} className="text-xs text-muted-foreground">{label}{money ? <MoneyInput aria-label={`${aria} ${labelSuffix}`} required maxLength={24} value={input[key]} onValueChange={(raw) => setInput({ ...input, [key]: raw })} className={`${sellerInput} mt-2`} /> : <input aria-label={`${aria} ${labelSuffix}`} required maxLength={50} value={input[key]} onChange={(event) => setInput({ ...input, [key]: event.target.value })} className={`${sellerInput} mt-2`} />}</label>)}
    </fieldset>
    <fieldset disabled={save.isPending} className="space-y-3">
      <legend className="text-sm font-medium">Shipping measurements per SKU unit</legend>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{parcelFields.map(({ key, label, max }) => <label key={key} className="text-xs text-muted-foreground">{label}<input aria-label={`${label} ${labelSuffix}`} type="number" inputMode="numeric" min={1} max={max} step={1} required={!sku || hasMeasurements} value={input[key]} onChange={(event) => setInput({ ...input, [key]: event.target.value })} className={`${sellerInput} mt-2`} /><span className="mt-1 block">1–{max.toLocaleString("en-US")}</span></label>)}</div>
      {sku && !sku.shippingParcel && <p className="text-xs text-muted-foreground">Add all four measurements so this SKU can be published for shipping.</p>}
    </fieldset>
    <div className="flex flex-wrap gap-2"><button type="submit" className={sellerButton} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save SKU"}</button><button type="button" className={sellerButton} disabled={save.isPending} onClick={onRemove}>Cancel SKU</button></div>
    {(validation || save.error) && <p role="alert" className="text-sm text-danger">{save.error?.detail || save.error?.title || validation}</p>}
  </form>;
}

function SkuStock({ sku, active }: { sku: ProductSku; active: boolean }) {
  const auth = useAuth();
  const [quantity, setQuantity] = useState("");
  const [validation, setValidation] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const stock = useApiQuery({ queryKey: queryKeys.catalog.stock(sku.id), service: (signal) => getProductAvailability(sku.id, { signal }) }, { enabled: active, retry: false });
  const intake = useApiMutation({
    execute: (amount: number) => {
      const controller = new AbortController(); pending.current = controller;
      return intakeStock({ skuId: sku.id, quantity: amount }, { context: auth.requestContext, signal: controller.signal });
    },
    isCurrent: () => auth.isSessionCurrent(auth.sessionId) && pending.current?.signal.aborted !== true,
    invalidateKey: [["inventory", "available"], queryKeys.seller.all(auth.sessionId)],
  }, { onSuccess: (balance, amount) => { setQuantity(""); setNotice(`Added ${amount.toLocaleString("en-US")} units. Available now: ${balance.available.toLocaleString("en-US")}.`); } });
  if (!active) return <p className="text-xs text-muted-foreground">Publish the product to add stock for this SKU.</p>;
  return <form aria-label={`Stock ${sku.skuCode}`} className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
    event.preventDefault(); setValidation(""); setNotice("");
    if (intake.isPending) return;
    const amount = Number(quantity);
    if (!/^\d+$/.test(quantity) || !Number.isSafeInteger(amount) || amount < 1 || amount > 2147483647) { setValidation("Enter a whole quantity of at least 1."); return; }
    intake.mutate(amount);
  }}>
    <div className="min-w-32"><p className="text-xs text-muted-foreground">In stock</p><p data-testid={`stock-${sku.id}`} className="mt-3 font-mono text-sm">{stock.isPending ? "…" : stock.isError ? "Unavailable" : stock.data.toLocaleString("en-US")}</p></div>
    <label className="text-xs text-muted-foreground">Quantity to add<input aria-label={`Quantity to add ${sku.skuCode}`} type="number" inputMode="numeric" min={1} step={1} required value={quantity} disabled={intake.isPending} onChange={(event) => setQuantity(event.target.value)} className={`${sellerInput} mt-2 w-40`} /></label>
    <button type="submit" className={sellerButton} disabled={intake.isPending}>{intake.isPending ? "Adding…" : "Add stock"}</button>
    {(validation || intake.error) && <p role="alert" className="w-full text-sm text-danger">{intake.error?.detail || intake.error?.title || validation}</p>}
    {notice && !intake.error && <p role="status" className="w-full text-sm text-success">{notice}</p>}
  </form>;
}

function SavedSku({ productId, sku, active, onSaved }: { productId: string; sku: ProductSku; active: boolean; onSaved: (sku: ProductSku) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <SkuEditor productId={productId} sku={sku} onSaved={(saved) => { onSaved(saved); setEditing(false); }} onRemove={() => setEditing(false)} />;
  return <div className="space-y-3 border-t border-border py-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <label className="text-xs text-muted-foreground">SKU code<input aria-label={`SKU code ${sku.skuCode}`} readOnly value={sku.skuCode} className={`${sellerInput} mt-2 bg-muted font-mono text-xs`} /></label>
    <div><p className="text-xs text-muted-foreground">Color</p><p className="mt-3 break-words text-sm">{sku.color || "—"}</p></div>
    <div><p className="text-xs text-muted-foreground">Size</p><p className="mt-3 break-words text-sm">{sku.size || "—"}</p></div>
    <div><p className="text-xs text-muted-foreground">Cost price</p><p data-testid={`cost-price-${sku.id}`} className="mt-3 font-mono text-sm">{sku.costPrice ? formatVND(sku.costPrice) : "—"}</p></div>
    <div><p className="text-xs text-muted-foreground">Selling price</p><p data-testid={`selling-price-${sku.id}`} className="mt-3 font-mono text-sm">{formatVND(sku.price)}</p></div>
  </div><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{sku.shippingParcel ? `${sku.shippingParcel.weightGrams.toLocaleString("en-US")} g · ${sku.shippingParcel.lengthCm} × ${sku.shippingParcel.widthCm} × ${sku.shippingParcel.heightCm} cm` : "Shipping measurements missing"}</p><button type="button" aria-label={`Edit SKU ${sku.skuCode}`} className={sellerButton} onClick={() => setEditing(true)}>Edit SKU</button></div><SkuStock sku={sku} active={active} /></div>;
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
  const [confirmDelete, setConfirmDelete] = useState(false);
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
  const update = useApiMutation({ execute: (input: SellerProductUpdate) => updateSellerProduct(initial.id, input, requestOptions()), isCurrent, invalidateKey }, {
    onSuccess: (product, input) => { setName((current) => current.trim() === input.name ? product.name : current); setNotice("Product saved."); },
  });
  const remove = useApiMutation({
    execute: () => deleteSellerProduct(initial.id, requestOptions()), isCurrent,
    invalidateKey: [[...queryKeys.seller.all(auth.sessionId), "listings"], [...queryKeys.seller.all(auth.sessionId), "products"], [...queryKeys.seller.all(auth.sessionId), "auction-products"], ["catalog", "products"]],
    removeKey: [[...queryKeys.seller.all(auth.sessionId), "product", initial.id], queryKeys.seller.auctionProduct(auth.sessionId, initial.id), queryKeys.catalog.product(initial.id)],
  }, { onSuccess: () => router.replace("/backoffice/products") });
  const publishReady = canPublishSellerProduct({ skus, images });
  const statusSave = useApiMutation({ execute: (target: SellerProductStatus) => {
    if (target === "ACTIVE" && !publishReady) throw { kind: "invalid-response", status: 0, title: "Save a SKU and an image, and complete every SKU’s shipping measurements before publishing." };
    return changeSellerProductStatus(initial.id, target, requestOptions());
  }, isCurrent, invalidateKey }, { onSuccess: (product) => { setStatus(product.status as SellerProductStatus); setNotice("Product status updated."); } });
  const imageSave = useApiMutation({ execute: (file: File) => uploadSellerImage(initial.id, file, requestOptions()), isCurrent, invalidateKey }, { onSuccess: (image) => { setImages((current) => [...current, image]); setNotice("Image uploaded through the backend."); } });
  const imageRemove = useApiMutation({ execute: (image: ProductImageModel) => removeSellerImage(initial.id, image.id, requestOptions()), isCurrent, invalidateKey }, { onSuccess: (_, image) => { setImages((current) => current.filter((row) => row.id !== image.id)); setNotice("Image removed."); } });
  const imageOrder = useApiMutation({ execute: (imageIds: string[]) => reorderSellerImages(initial.id, imageIds, requestOptions()), isCurrent, invalidateKey }, { onSuccess: (ordered) => { setImages(ordered); setNotice("Image order saved."); } });
  const moveImage = (index: number, offset: number) => {
    const ids = images.map((image) => image.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    imageOrder.mutate(ids);
  };
  const busy = save.isPending || update.isPending || remove.isPending || statusSave.isPending || imageSave.isPending || imageRemove.isPending || imageOrder.isPending;
  const error = save.error || update.error || statusSave.error || imageSave.error || imageRemove.error || imageOrder.error;

  return <>
    <Link href="/backoffice/products" className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-primary">Products / {name || "New product"}</Link>
    <SellerHeading title={newProduct ? "New Product" : "Edit Product"} description={newProduct ? "Create a draft before adding SKUs and images." : "Manage this product’s SKUs, images and publication."}><button type="submit" form="seller-product-form" className={sellerPrimary} disabled={busy}>{save.isPending || update.isPending ? "Saving…" : "Save Changes"}</button></SellerHeading>
    {notice && <p role="status" className="text-sm text-success">{notice}</p>}{error && <p role="alert" className="text-sm text-danger">{error.detail || error.title}</p>}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-6">
        <SellerPanel title="Basic Information"><form id="seller-product-form" onSubmit={(event) => { event.preventDefault(); if (busy) return; if (newProduct) save.mutate(); else update.mutate({ name: name.trim(), description, categoryId: category, auctionEnable }); }} className="space-y-5">
          <label className="block text-sm">Product Name<input required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} className={`${sellerInput} mt-2`} /></label>
          <label className="block text-sm">Category<select aria-label="Category" required disabled={categories.isPending || busy} value={category} onChange={(event) => setCategory(event.target.value)} className={`${sellerInput} mt-2`}><option value="">Select category</option>{categories.data?.flatMap((root) => [root, ...root.children, ...root.children.flatMap((child) => child.children)]).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          {categories.isPending && <p role="status" className="text-sm text-muted-foreground">Loading categories…</p>}
          {categories.error && <p role="alert" className="text-sm text-danger">Categories could not be loaded. <button type="button" onClick={() => void categories.refetch()} className="underline">Retry categories</button></p>}
          <label className="block text-sm">Description<textarea rows={5} value={description} onChange={(event) => setDescription(event.target.value)} className={`${sellerInput} mt-2`} /></label>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={auctionEnable} onChange={(event) => setAuctionEnable(event.target.checked)} />Allow auction listings</label>
        </form></SellerPanel>
        {!newProduct && <>
          <SellerPanel title="Media"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{images.map((image, index) => <div key={image.id} className="min-w-0"><div className="aspect-square overflow-hidden rounded-sm bg-muted"><ProductImage src={image.imageUrl} alt={`${name} ${index + 1}`} productName={name} /></div><div className="mt-2 flex gap-2"><button type="button" aria-label={`Move image ${index + 1} earlier`} className={`${sellerButton} flex-1 px-0`} disabled={busy || index === 0} onClick={() => moveImage(index, -1)}><ArrowLeft size={16} aria-hidden="true" /></button><button type="button" aria-label={`Move image ${index + 1} later`} className={`${sellerButton} flex-1 px-0`} disabled={busy || index === images.length - 1} onClick={() => moveImage(index, 1)}><ArrowRight size={16} aria-hidden="true" /></button></div><button type="button" className={`${sellerButton} mt-2 w-full`} disabled={busy} onClick={() => imageRemove.mutate(image)}>Remove</button></div>)}<button type="button" className="flex aspect-square min-h-24 flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-input p-3 text-sm disabled:opacity-50" disabled={images.length >= 5 || busy} onClick={() => fileInput.current?.click()}><Upload size={20} aria-hidden="true" />{imageSave.isPending ? "Uploading…" : "Add Image"}</button></div>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Product image file" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setNotice("Choose a JPEG, PNG or WebP image up to 5 MiB."); return; } imageSave.mutate(file); }} /><p className="mt-3 text-xs text-muted-foreground">Up to 5 images, JPEG/PNG/WebP, 5 MiB each.</p>
          </SellerPanel>
          <SellerPanel title="Pricing & SKUs">{skus.map((sku) => <SavedSku key={sku.id} productId={initial.id} sku={sku} active={status === "ACTIVE"} onSaved={(saved) => { setSkus((current) => current.map((row) => row.id === saved.id ? saved : row)); setNotice("SKU saved."); }} />)}{skuForms.map((key) => <SkuEditor key={key} productId={initial.id} onSaved={(sku) => { setSkus((current) => [...current, sku]); setSkuForms((current) => current.filter((row) => row !== key)); setNotice("SKU saved."); }} onRemove={() => setSkuForms((current) => current.filter((row) => row !== key))} />)}<button type="button" className={`${sellerButton} mt-4`} onClick={() => setSkuForms((current) => [...current, crypto.randomUUID()])}><Plus size={16} aria-hidden="true" />Add SKU</button></SellerPanel>
        </>}
      </div>
      <aside><SellerPanel title="Status"><p className="font-medium">{status}</p>{!newProduct && <button type="button" className={`${sellerPrimary} mt-4 w-full`} disabled={busy || status !== "ACTIVE" && !publishReady} onClick={() => statusSave.mutate(status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>{statusSave.isPending ? "Updating…" : status === "ACTIVE" ? "Unpublish" : "Publish"}</button>}{!newProduct && !publishReady && <p className="mt-3 text-xs leading-5 text-muted-foreground">Save at least one SKU and upload an image before publishing. Every saved SKU needs weight, length, width and height. Unsaved SKU rows do not count.</p>}
        {!newProduct && <div className="mt-5 border-t border-border pt-5">{confirmDelete ? <><p className="text-sm">Delete this product? It disappears from your products and the shop.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className={`${sellerButton} text-danger`} disabled={busy} onClick={() => remove.mutate()}>{remove.isPending ? "Deleting…" : "Confirm delete"}</button><button type="button" className={sellerButton} disabled={busy} onClick={() => { setConfirmDelete(false); remove.reset(); }}>Keep product</button></div></> : <button type="button" className={`${sellerButton} w-full text-danger`} disabled={busy} onClick={() => setConfirmDelete(true)}>Delete product</button>}{remove.error && <p role="alert" className="mt-3 break-words text-sm text-danger">{remove.error.detail || remove.error.title}</p>}</div>}
      </SellerPanel></aside>
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
