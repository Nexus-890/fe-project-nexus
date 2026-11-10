"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ImagePlus, Upload } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import { queryKeys } from "@/configs/queryKeys";
import { useApiMutation } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { uploadProductImage } from "@/service/productImageService";
import type { ProductImage as UploadedImage } from "@/types/catalogResponseType";

type UploadOperation = { productId: string; file: File; sessionId: number; controller: AbortController };

function ProductImagesForm() {
  const { status, sessionId, requestContext, isSessionCurrent } = useAuth();
  const [productId, setProductId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), [sessionId]);
  const upload = useApiMutation<UploadedImage, UploadOperation>({
    mutationKey: ["product-image", sessionId, "upload"],
    execute: (operation) => uploadProductImage(operation.productId, operation.file, { context: requestContext, signal: operation.controller.signal }),
    isCurrent: (operation) => isSessionCurrent(operation.sessionId) && !operation.controller.signal.aborted,
    invalidateKey: (_data, operation) => [queryKeys.catalog.product(operation.productId), ["catalog", "products"], ["catalog", "cart-products"]],
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId.trim())) { setValidation("Enter a valid product ID."); return; }
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) { setValidation("Choose a JPEG, PNG or WebP image up to 5 MB."); return; }
    if (status !== "authenticated" || upload.isPending) return;
    setValidation("");
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    upload.mutate({ productId: productId.trim(), file, sessionId, controller });
  }

  return <div className="mx-auto max-w-[1248px] px-4 py-8 sm:px-6">
    <Link href="/" className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-primary">Back to shopping</Link>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Product images</h1>
    <p className="mt-3 text-sm text-muted-foreground">Upload photos for a product you sell. JPEG, PNG and WebP, up to 5 MB each.</p>
    {status !== "authenticated" ? <div className="mt-6 rounded-md border border-border p-6"><p>Sign in with your seller account to manage product photos.</p><Link href="/sign-in?returnTo=%2Fsell%2Fimages" className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-primary-foreground">Sign in</Link></div> : <form onSubmit={submit} className="mt-6 max-w-xl space-y-5 rounded-md border border-border p-6">
      <div><label htmlFor="product-image-product" className="text-sm font-medium">Product ID</label><input id="product-image-product" required value={productId} onChange={(event) => { setProductId(event.target.value); upload.reset(); }} disabled={upload.isPending} className="mt-2 min-h-11 w-full rounded-sm border border-input bg-background px-3 text-sm" placeholder="Paste your product ID" /></div>
      <div><label htmlFor="product-image-file" className="text-sm font-medium">Product photo</label><div className="mt-2 rounded-md border border-dashed border-border bg-muted p-6"><ImagePlus className="mb-3 text-primary" aria-hidden="true" /><input ref={input} id="product-image-file" type="file" accept="image/jpeg,image/png,image/webp" required disabled={upload.isPending} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setValidation(""); upload.reset(); }} className="min-h-11 max-w-full text-sm file:mr-3 file:min-h-11 file:rounded-sm file:border file:border-border file:bg-background file:px-3" /></div></div>
      {validation ? <p role="alert" className="text-sm text-danger">{validation}</p> : null}
      {upload.error ? <p role="alert" className="text-sm text-danger">{upload.error.detail || upload.error.title}</p> : null}
      <button type="submit" disabled={upload.isPending} className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"><Upload size={16} aria-hidden="true" />{upload.isPending ? "Uploading…" : "Upload photo"}</button>
      {upload.data && upload.variables?.sessionId === sessionId ? <div role="status" className="space-y-3"><p className="font-medium text-success">Photo uploaded successfully</p><div className="h-56 rounded-md bg-muted p-4"><ProductImage src={upload.data.imageUrl} alt="Uploaded product photo" productName="Uploaded product" /></div><a href={upload.data.imageUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm text-primary underline">View uploaded image</a></div> : null}
    </form>}
  </div>;
}

function ProductImagesPage() {
  const { sessionId } = useAuth();
  return <ProductImagesForm key={sessionId} />;
}

export default ProductImagesPage;
