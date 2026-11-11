"use client";

import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import ProductImage from "./ProductImage";

function ProfilePhotoPreview({ fullName }: { fullName: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);
  return <div className="mb-6">
    <div className="flex flex-wrap items-center gap-3"><div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">{photo ? <ProductImage src={photo} alt="Local profile photo preview" productName="Profile" /> : <span aria-label={`${fullName}'s initials`} className="text-lg font-medium">{fullName.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase()}</span>}</div>
      <input type="file" ref={input} tabIndex={-1} accept="image/jpeg,image/png,image/webp" aria-label="Choose sample profile photo" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) { setError("Choose a JPEG, PNG or WebP image up to 2 MB."); event.target.value = ""; return; } setError(undefined); setPhoto(URL.createObjectURL(file)); event.target.value = ""; }} />
      <button type="button" onClick={() => input.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-border px-3 text-xs font-medium hover:bg-muted"><Upload size={15} aria-hidden="true" />Preview Photo</button><button type="button" disabled={!photo} onClick={() => { setPhoto(undefined); setError(undefined); }} className="min-h-11 rounded-sm px-3 text-xs hover:bg-muted disabled:opacity-50">Remove Preview</button>
    </div><p className="mt-2 text-xs leading-5 text-muted-foreground">Photo preview only (JPEG, PNG, WebP · up to 2 MB). No image is uploaded or saved; profile photo API is unavailable.</p>
    {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
  </div>;
}

export default ProfilePhotoPreview;
