"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { ImageOff } from "lucide-react";

interface ProductImageProps {
  src?: string;
  alt: string;
  productName: string;
  loading?: "eager" | "lazy";
  compact?: boolean;
}

function ProductImage({
  src,
  alt,
  productName,
  loading = "eager",
  compact = false,
}: ProductImageProps) {
  const url = src?.trim();
  const [failedUrl, setFailedUrl] = useState<string>();

  // Render a local placeholder instead of assigning another URL in onError:
  // an unavailable placeholder asset must never cause an error/retry loop.
  if (!url || failedUrl === url) {
    return (
      <div
        role="img"
        aria-label={`${productName} image placeholder`}
        className={`flex h-full w-full flex-col items-center justify-center text-center text-xs text-muted-foreground ${compact ? "p-1" : "gap-2 p-2"}`}
      >
        <ImageOff size={compact ? 16 : 24} aria-hidden="true" className="shrink-0" />
        {!compact && <span>Image unavailable</span>}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setFailedUrl(url)}
      className="h-full w-full object-contain"
    />
  );
}

export default ProductImage;
