import type { ProductImage } from "../types/catalogResponseType";

export const sortProductImages = (
  images: readonly ProductImage[] = [],
): ProductImage[] =>
  [...images].sort((left, right) => left.sortOrder - right.sortOrder);
