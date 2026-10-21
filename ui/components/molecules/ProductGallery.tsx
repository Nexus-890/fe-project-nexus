"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductImage } from "@/types/catalog/response/type";

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}
/**
 * Product image gallery used by the detail page.
 *
 * Images come from the product API. The selected image lives in client state;
 * changing it never triggers a request.
 */
export default function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const hasImages = images.length > 0;
  const visibleIndex = hasImages ? Math.min(selectedIndex, images.length - 1) : 0;
  const selectedImage = images[visibleIndex];

  const move = (offset: number) => {
    if (!hasImages) return;
    setSelectedIndex((current) => (Math.min(current, images.length - 1) + offset + images.length) % images.length);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    }
  };

  if (!hasImages) {
    return (
      <div
        className="flex h-[min(92vw,520px)] min-h-[280px] max-h-[520px] items-center justify-center rounded-md bg-black px-6 text-center text-sm text-white"
        role="img"
        aria-label={`${productName} image placeholder`}
      >
        Product image placeholder
      </div>
    );
  }

  return (
    <div className="min-w-0" onKeyDown={handleKeyDown}>
      <div
        className="group relative flex h-[min(92vw,520px)] min-h-[280px] max-h-[520px] items-center justify-center overflow-hidden rounded-md bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        role="region"
        aria-label={`${productName} image gallery`}
        tabIndex={0}
      >
        <img
          key={selectedImage.imageUrl}
          src={selectedImage.imageUrl}
          alt={`${productName} view ${visibleIndex + 1} of ${images.length}`}
          className="h-full w-full object-contain"
        />

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Previous product image"
              className="absolute left-2 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 opacity-100 shadow-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:left-3 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Next product image"
              className="absolute right-2 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 opacity-100 shadow-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:right-3 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div
          className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
          role="list"
          aria-label="Product image thumbnails"
        >
          {images.map((image, index) => (
            <button
              key={image.id || image.imageUrl}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`View ${productName} image ${index + 1}`}
              aria-current={index === visibleIndex ? "true" : undefined}
              className={`inline-flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md border bg-black p-0.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-[80px] sm:w-[80px] ${index === visibleIndex ? "border-2 border-primary" : "border-border hover:border-gray-500"}`}
            >
              <img
                src={image.imageUrl}
                alt={`${productName} thumbnail ${index + 1}`}
                className="h-full w-full object-contain"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
