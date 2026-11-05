"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductImage } from "@/types/catalogResponseType";
import ProductImageView from "./ProductImage";
import { sortProductImages } from "./productImageUtils";

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}
/**
 * Product image gallery used by the detail page.
 *
 * Image selection is local; switching views never triggers another API call.
 */
function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const sortedImages = sortProductImages(images);

  const hasImages = images.length > 0;
  const visibleIndex = hasImages
    ? Math.min(selectedIndex, images.length - 1)
    : 0;
  const selectedImage = sortedImages[visibleIndex];

  const move = (offset: number) => {
    if (!hasImages) return;
    setSelectedIndex(
      (current) =>
        (Math.min(current, images.length - 1) + offset + images.length) %
        images.length,
    );
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

  return (
    <div className="min-w-0" onKeyDown={handleKeyDown}>
      <div
        className="group relative aspect-square w-full overflow-hidden rounded-sm bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        role="region"
        aria-label={`${productName} image gallery`}
        tabIndex={0}
      >
        <ProductImageView
          key={selectedImage?.imageUrl ?? "empty"}
          src={selectedImage?.imageUrl}
          productName={productName}
          alt={`${productName} view ${visibleIndex + 1} of ${images.length}`}
        />

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Previous product image"
              className="absolute left-2 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:left-3 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Next product image"
              className="absolute right-2 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:right-3 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      {hasImages ? (
        <div
          className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
          role="group"
          aria-label="Product image thumbnails"
        >
          {sortedImages.map((image, index) => (
            <button
              key={image.id || image.imageUrl}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`View ${productName} image ${index + 1}`}
              aria-current={index === visibleIndex ? "true" : undefined}
              className={`inline-flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-sm border bg-black p-0.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-[80px] sm:w-[80px] ${index === visibleIndex ? "border-2 border-primary" : "border-border hover:border-muted-foreground"}`}
            >
              <ProductImageView
                key={image.imageUrl}
                src={image.imageUrl}
                productName={productName}
                alt={`${productName} thumbnail ${index + 1}`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ProductGallery;
